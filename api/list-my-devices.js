// api/list-my-devices.js
import { db } from "./firebase-admin.config.js";

function tsToMs(v) {
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "object" && typeof v._seconds === "number") return Math.round(v._seconds * 1000);
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

    const { uid } = req.query || {};
    if (!uid) return res.status(400).json({ error: "uid_required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const user = userSnap.data() || {};

    // --- summary fields for Account ---
    const planMap = user.plan || null;
    const planType = user.planType ?? planMap?.type ?? null;
    const status = user.status ?? planMap?.status ?? "unknown";
    const userMaxDevices = user.maxDevices ?? planMap?.maxDevices ?? null;
    const expiryMs = tsToMs(user.expiresAt ?? planMap?.expiresAt) ?? null;
    const subscription = user.subscription || null;
    const codeId = user.tokenId || user.codeId || user.currentCode || null;

    // --- fetch user's own devices: users/{uid}/devices ---
    const userDevsSnap = await userRef.collection("devices").get();
    const userDevices = userDevsSnap.docs.map((d) => {
      const m = d.data() || {};
      return {
        id: d.id,
        name: m.name ?? m.deviceName ?? "این دستگاه",
        isActive:
          m.isActive === true ||
          String(m.status || "").toLowerCase() === "active" ||
          (!("isActive" in m) && String(m.status || "") === ""),
        code: m.code ?? m.token ?? m.subscriptionCode ?? null,
        createdAt: tsToMs(m.registeredAt ?? m.createdAt),
        lastSeen: tsToMs(m.lastSeenAt ?? m.lastSeen),
      };
    });

    // if no code, still return
    if (!codeId) {
      return res.status(200).json({
        ok: true,
        codeId: null,
        maxDevices: null,
        activeDevices: 0,
        devices: [],          // kept for backward-compat (code devices)
        userDevices,          // NEW: user-level devices for app UI
        plan: planMap,
        planType,
        status,
        expiry: expiryMs,
        subscription,
        userMaxDevices,
        usedDevices: userDevices.filter((d) => d.isActive).length,
        remaining:
          userMaxDevices == null ? null : userMaxDevices - userDevices.filter((d) => d.isActive).length,
      });
    }

    // --- code devices: codes/{codeId}/devices for this uid ---
    const codeRef = db.collection("codes").doc(codeId);
    const [codeSnap, codeDevsSnap] = await Promise.all([
      codeRef.get(),
      codeRef.collection("devices").where("uid", "==", uid).get(),
    ]);

    const code = codeSnap.exists ? codeSnap.data() : null;
    const codeDevices = codeDevsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const activeFromCode = typeof code?.activeDevices === "number" ? code.activeDevices : null;
    const computedActive = codeDevices.reduce((acc, m) => {
      const statusStr = String(m?.status || "").toLowerCase();
      const hasIsActive = Object.prototype.hasOwnProperty.call(m || {}, "isActive");
      const isActive =
        m?.isActive === true ||
        statusStr === "active" ||
        (statusStr === "" && (!hasIsActive || m?.isActive !== false));
      return acc + (isActive ? 1 : 0);
    }, 0);

    const usedDevices = activeFromCode ?? computedActive;
    const codeMaxDevices = typeof code?.maxDevices === "number" ? code.maxDevices : null;
    const remaining = codeMaxDevices == null ? null : codeMaxDevices - usedDevices;

    
    return res.status(200).json({
      ok: true,
      codeId,
      maxDevices: codeMaxDevices,
      activeDevices: usedDevices,
      devices: codeDevices,   // kept for Admin/backward-compat
      userDevices,            // NEW: user's own devices for AccountScreen
      plan: planMap,
      planType,
      status,
      expiry: expiryMs,
      subscription,
      userMaxDevices,
      usedDevices,
      remaining,
    });
  } catch (e) {
    console.error("list-my-devices error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
