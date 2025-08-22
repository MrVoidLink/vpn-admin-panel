// File: api/get-user-summary.js
// Runtime: Vercel Node.js Serverless (CommonJS)
// Purpose: Return a compact account summary for Account Screen / Sheet
//
// Response shape:
// {
//   uid: string,
//   planType: "premium" | "gift" | null,
//   codeId: string | null,
//   activatedAt: number | null, // ms epoch
//   expiresAt: number | null,   // ms epoch
//   maxDevices: number | 0,
//   activeDevicesCount: number,
//   activeDevices: [{ deviceId, deviceModel, lastSeenAt }]
// }

const admin = require("firebase-admin");

// ---- CORS helper (allow app requests) ----
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
}

// ---- Safe getter for Firestore Timestamp or number -> ms ----
function toMillis(v) {
  // Firestore Timestamp
  if (v && typeof v.toMillis === "function") return v.toMillis();
  // number (already ms)
  if (typeof v === "number") return v;
  // string numeric
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}

// ---- Initialize Firebase Admin once per cold start ----
function initAdmin() {
  if (admin.apps.length) return admin.app();

  // Option A: GOOGLE_APPLICATION_CREDENTIALS (recommended on Vercel with env var JSON)
  // Option B: individual env vars for service account
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    GOOGLE_APPLICATION_CREDENTIALS_JSON, // optional: full JSON string
  } = process.env;

  if (GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const creds = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key?.replace(/\\n/g, "\n"),
      }),
    });
  }

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  // Fallback: application default (if configured)
  return admin.initializeApp();
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const uid = (req.query?.uid || "").trim();
    if (!uid) {
      res.status(400).json({ error: "Missing uid" });
      return;
    }

    // (Optional) Simple API key guard if you already use it elsewhere
    // const EXPECTED = process.env.APP_TO_API_KEY;
    // const provided = req.headers["x-api-key"];
    // if (EXPECTED && provided !== EXPECTED) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }

    const app = initAdmin();
    const db = admin.firestore(app);

    // ---------- 1) Fetch user document ----------
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = userSnap.data() || {};

    // Try multiple field names to be robust
    const codeId = user.currentCode || user.codeId || null;
    const expiresAt = toMillis(user.expiresAt);
    const activatedAt =
      toMillis(user.activatedAt) || // if stored on user
      null;

    // If your schema stores maxDevices on user:
    const maxDevicesUser = typeof user.maxDevices === "number" ? user.maxDevices : null;

    // ---------- 2) Fetch code document (to get planType / maxDevices / activatedAt) ----------
    let planType = user.planType || null; // allow user-level override if exists
    let maxDevices = maxDevicesUser ?? 0;
    let activatedAtFinal = activatedAt;

    if (codeId) {
      // TODO: If your codes collection name differs, change "codes" here
      const codeRef = db.collection("codes").doc(codeId);
      const codeSnap = await codeRef.get();
      if (codeSnap.exists) {
        const code = codeSnap.data() || {};
        // Common fields on code doc: type, planType, durationDays, maxDevices, activatedAt/expiresAt...
        planType = planType || code.planType || code.type || null;

        if (typeof code.maxDevices === "number" && !maxDevicesUser) {
          maxDevices = code.maxDevices;
        } else if (maxDevicesUser != null) {
          maxDevices = maxDevicesUser;
        }

        // prefer explicit activatedAt from code if not on user
        if (!activatedAtFinal) {
          activatedAtFinal = toMillis(code.activatedAt) || null;
        }

        // If expiresAt missing on user, try from code
        if (!expiresAt && code.expiresAt) {
          // NOTE: we intentionally do not override user.expiresAt if it's present
        }
      }
    }

    // ---------- 3) Load devices linked to this uid ----------
    // Try main "devices" collection
    let devices = [];
    const mapDeviceDoc = (id, d) => ({
      deviceId: d.deviceId || id, // fall back to doc id
      deviceModel: d.deviceModel || d.model || null,
      lastSeenAt: toMillis(d.lastSeenAt),
    });

    // TODO: If your collection name is different (e.g., "userDevices"), adjust below.
    const devicesColCandidates = ["devices", "userDevices"];
    let foundAny = false;

    for (const col of devicesColCandidates) {
      // If devices stored at top-level with uid field:
      const q = await db
        .collection(col)
        .where("uid", "==", uid)
        .orderBy("lastSeenAt", "desc")
        .get()
        .catch(() => null);

      if (q && !q.empty) {
        devices = q.docs.map((doc) => mapDeviceDoc(doc.id, doc.data() || {}));
        foundAny = true;
        break;
      }

      // If devices stored under users/{uid}/devices subcollection:
      const sub = await db
        .collection("users")
        .doc(uid)
        .collection(col)
        .orderBy("lastSeenAt", "desc")
        .get()
        .catch(() => null);

      if (sub && !sub.empty) {
        devices = sub.docs.map((doc) => mapDeviceDoc(doc.id, doc.data() || {}));
        foundAny = true;
        break;
      }
    }

    // ---------- 4) Build summary ----------
    const summary = {
      uid,
      planType: planType || null,
      codeId: codeId || null,
      activatedAt: activatedAtFinal,
      expiresAt: expiresAt ?? null,
      maxDevices: typeof maxDevices === "number" ? maxDevices : 0,
      activeDevicesCount: Array.isArray(devices) ? devices.length : 0,
      activeDevices: devices,
    };

    res.status(200).json(summary);
  } catch (err) {
    console.error("get-user-summary error:", err);
    res.status(500).json({ error: "Internal Server Error", detail: String(err?.message || err) });
  }
};
