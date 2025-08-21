// api/list-my-devices.js
import { db } from "./firebase-admin.config.js";

/** Normalize Firestore Timestamp/Date/number to epoch ms (or null) */
function tsToMs(v) {
  if (!v) return null;
  // Firestore Timestamp has toMillis()
  if (typeof v?.toMillis === "function") return v.toMillis();
  // { _seconds, _nanoseconds }
  if (typeof v === "object" && typeof v._seconds === "number") {
    return Math.round(v._seconds * 1000);
  }
  // Date
  if (v instanceof Date) return v.getTime();
  // number (assume ms or s)
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { uid } = req.query || {};
    if (!uid) return res.status(400).json({ error: "uid_required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const user = userSnap.data() || {};

    // ------ Gather user-level aliases (for Admin panel compatibility) ------
    const planMap = user.plan || null;
    const planType =
      user.planType ?? planMap?.type ?? null;
    const status =
      user.status ?? planMap?.status ?? "unknown";
    const userMaxDevices =
      user.maxDevices ?? planMap?.maxDevices ?? null;
    const expiryMs =
      tsToMs(user.expiresAt ?? planMap?.expiresAt) ?? null;
    const subscription = user.subscription || null;

    const codeId = user.tokenId || user.codeId || user.currentCode || null;

    // If user has no code, still return user summary + empty devices (preserve shape)
    if (!codeId) {
      return res.status(200).json({
        ok: true,
        codeId: null,
        // keep existing fields for Admin
        maxDevices: null,
        activeDevices: 0,
        devices: [],
        // added summary fields (non-breaking additions)
        plan: planMap,
        planType,
        status,
        expiry: expiryMs,
        subscription,
        userMaxDevices,
        usedDevices: 0,
        remaining: userMaxDevices == null ? null : userMaxDevices - 0,
      });
    }

    // ------ With a code: collect code doc + devices under code for this user ------
    const codeRef = db.collection("codes").doc(codeId);
    const [codeSnap, devsSnap] = await Promise.all([
      codeRef.get(),
      codeRef.collection("devices").where("uid", "==", uid).get(),
    ]);

    const code = codeSnap.exists ? codeSnap.data() : null;
    const devices = devsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // active count by code (if not present, compute from devices)
    const activeDevicesFromCode =
      typeof code?.activeDevices === "number" ? code.activeDevices : null;

    const computedActive = devices.reduce((acc, m) => {
      const statusStr = (m?.status || "").toString().toLowerCase();
      const hasIsActive = Object.prototype.hasOwnProperty.call(m || {}, "isActive");
      const isActive = m?.isActive === true ||
        statusStr === "active" ||
        (statusStr === "" && (!hasIsActive || m?.isActive !== false));
      return acc + (isActive ? 1 : 0);
    }, 0);

    const usedDevices = activeDevicesFromCode ?? computedActive;
    const codeMaxDevices =
      typeof code?.maxDevices === "number" ? code.maxDevices : null;

    const remaining =
      codeMaxDevices == null ? null : codeMaxDevices - usedDevices;

    // ------ Response (preserve existing fields, only add new ones) ------
    return res.status(200).json({
      ok: true,
      codeId,
      maxDevices: codeMaxDevices,
      activeDevices: usedDevices, // keep same name; prefer actual active usage
      devices,

      // Added fields for app Account/AccountSheet (non-breaking)
      plan: planMap,
      planType,
      status,
      expiry: expiryMs,
      subscription,
      userMaxDevices, // maxDevices inferred from user's plan (if any)
      usedDevices,
      remaining,
    });
  } catch (e) {
    console.error("list-my-devices error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
