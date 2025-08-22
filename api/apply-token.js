// vite-project/api/apply-token.js
// Serverless function for Vercel (Node.js runtime)
// Mirrors TokenService.applyToken logic exactly using Firebase Admin (server-side)

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// ---------- Firebase Admin init ----------
function initAdmin() {
  if (!getApps().length) {
    // Expect service account in env; adjust to your deployment style
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase Admin credentials in env");
    }
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

// ---------- Helpers ----------
const asIntNullable = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
};

const normalizeEpochMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  const n = asIntNullable(v);
  if (n != null) return n < 100000000000 ? n * 1000 : n; // sec → ms
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
};

function bad(res, status, error) {
  return res.status(status).json({ success: false, error });
}

// ---------- Handler ----------
export default async function handler(req, res) {
  // Basic CORS (adjust domains if needed)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return bad(res, 405, "Method Not Allowed");

  let db;
  try {
    db = initAdmin();
  } catch (e) {
    return bad(res, 500, `Admin init failed: ${e.message || e}`);
  }

  const {
    code: rawCode,
    uid,
    deviceId,
    deviceModel,
    language,
    appVersion,
    platform,
    planType: planTypeInput,
    maxDevices: maxDevicesInput,
  } = req.body || {};

  const code = (rawCode || "").trim();
  if (!code) return bad(res, 400, "Missing code");
  if (!uid) return bad(res, 400, "Missing uid");
  if (!deviceId) return bad(res, 400, "Missing deviceId");

  const nowMs = Date.now();
  const codeRef = db.collection("codes").doc(code);
  const userRef = db.collection("users").doc(uid);
  const userDeviceRef = userRef.collection("devices").doc(deviceId);
  const codeDeviceDocId = `${uid}_${deviceId}`;
  const codeDeviceRef = codeRef.collection("devices").doc(codeDeviceDocId);
  const activationRef = codeRef.collection("activations").doc(codeDeviceDocId);

  try {
    const result = await db.runTransaction(async (tx) => {
      // 1) Read code doc
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("Invalid code: not found");
      const cdata = codeSnap.data() || {};

      // plan / capacity / source
      const planType = String(cdata.type ?? cdata.plan ?? planTypeInput ?? "premium");
      const source = String(cdata.source ?? "code");
      const maxDevices = asIntNullable(cdata.maxDevices ?? maxDevicesInput);
      const validForDays = asIntNullable(cdata.validForDays);

      // expiry resolve
      let expiresAtMs = normalizeEpochMs(cdata.expiresAt ?? cdata.expiry);
      if (expiresAtMs == null && validForDays && validForDays > 0) {
        expiresAtMs = new Date(nowMs + validForDays * 86400000).getTime();
      }
      if (expiresAtMs != null && expiresAtMs <= nowMs) {
        throw new Error("Code expired");
      }

      // activatedAt
      const hasActivatedAt = cdata.activatedAt != null || cdata.activatedAtTs != null;
      const activatedAtMs = hasActivatedAt ? (normalizeEpochMs(cdata.activatedAt) ?? nowMs) : nowMs;

      // 2) code-device status
      const codeDevSnap = await tx.get(codeDeviceRef);
      const codeDevData = codeDevSnap.exists ? codeDevSnap.data() || {} : {};
      const wasActive =
        codeDevSnap.exists &&
        (codeDevData.isActive === true || codeDevData.status === "active");

      // capacity check
      if (maxDevices != null && !wasActive) {
        const currentlyUsed = asIntNullable(cdata.activeDevices) ?? 0;
        if (currentlyUsed >= maxDevices) {
          throw new Error("Code device capacity reached");
        }
      }

      // 3) merge metadata on code doc
      const codeMerge = {
        source,
        ...(hasActivatedAt
          ? {}
          : { activatedAt: activatedAtMs, status: "active" }),
        ...(cdata.type == null ? { type: planType } : {}),
      };
      const hasExpiresAtOnCode = cdata.expiresAt != null || cdata.expiry != null;
      if (expiresAtMs != null && !hasExpiresAtOnCode) {
        codeMerge.expiresAt = expiresAtMs;
      }
      tx.set(codeRef, codeMerge, { merge: true });

      // 4) link/activate device under codes/{code}/devices/{uid_deviceId}
      const deviceSet = {
        uid,
        deviceId,
        status: "active",
        isActive: true,
        lastSeenAt: FieldValue.serverTimestamp(),
      };
      if (!codeDevSnap.exists || codeDevData.createdAt == null) {
        deviceSet.createdAt = FieldValue.serverTimestamp();
      }
      tx.set(codeDeviceRef, deviceSet, { merge: true });

      // ++activeDevices if newly active
      if (!wasActive) {
        tx.set(
          codeRef,
          { activeDevices: FieldValue.increment(1), status: "active" },
          { merge: true }
        );
      }

      // 5) update users/{uid} flat aliases + plan + subscription mirror
      const planObj = {
        type: planType,
        source,
        status: "active",
        codeId: code,
        ...(validForDays != null ? { validForDays } : {}),
        ...(maxDevices != null ? { maxDevices } : {}),
        activatedAt: Timestamp.fromMillis(activatedAtMs),
        ...(expiresAtMs != null ? { expiresAt: Timestamp.fromMillis(expiresAtMs) } : {}),
      };

      const userMerge = {
        currentCode: code,
        tokenId: code,
        codeId: code,
        ...(validForDays != null ? { validForDays } : {}),
        ...(maxDevices != null ? { maxDevices } : {}),
        ...(expiresAtMs != null ? { expiresAt: expiresAtMs } : {}),
        source,
        planType,
        status: "active",
        lastSeenAt: FieldValue.serverTimestamp(),
        plan: planObj,
        subscription: {
          codeId: code,
          source,
          ...(expiresAtMs != null ? { expiresAt: expiresAtMs } : {}),
        },
        // Optional: keep some context info if sent
        ...(deviceModel ? { deviceModel } : {}),
        ...(language ? { language } : {}),
        ...(appVersion ? { appVersion } : {}),
        ...(platform ? { platform } : {}),
      };
      tx.set(userRef, userMerge, { merge: true });

      // 6) users/{uid}/devices/{deviceId}
      tx.set(
        userDeviceRef,
        {
          code,
          tokenId: code,
          status: "active",
          isActive: true,
          linkedCodeId: code,
          planType,
          activatedAt: Timestamp.fromMillis(activatedAtMs),
          claimedAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
          ...(deviceModel ? { deviceModel } : {}),
          ...(platform ? { platform } : {}),
        },
        { merge: true }
      );

      // 7) activation log
      tx.set(
        activationRef,
        {
          uid,
          deviceId,
          planType,
          source,
          activatedAt: Timestamp.fromMillis(activatedAtMs),
          ...(expiresAtMs != null ? { expiresAt: Timestamp.fromMillis(expiresAtMs) } : {}),
          at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        planType,
        maxDevices: maxDevices ?? null,
        expiresAt: expiresAtMs ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      planType: result.planType,
      maxDevices: result.maxDevices,
      expiresAt: result.expiresAt,
    });
  } catch (e) {
    // Normalize common errors
    const msg = (e && e.message) ? e.message : String(e);
    const status =
      msg.includes("not found") || msg.toLowerCase().includes("invalid code")
        ? 404
        : msg.toLowerCase().includes("expired")
        ? 410
        : msg.toLowerCase().includes("capacity")
        ? 409
        : 400;

    return bad(res, status, msg);
  }
}
