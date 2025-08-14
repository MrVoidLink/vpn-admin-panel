// api/release-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) { try { body = await req.json?.(); } catch (_) {} }
    const { uid, codeId, deviceId } = body || {};
    if (!uid || !codeId || !deviceId)
      return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const [codeSnap, devSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const now = admin.firestore.Timestamp.now();

      const maxDevices = Number(code.maxDevices ?? 0);
      const active = Number(code.activeDevices ?? 0);

      const devData = (devSnap.data() || {});
      // ✅ سازگار با دو مدل ذخیره‌سازی: isActive=true یا status='active'
      const wasActive = devSnap.exists && (devData.isActive === true || devData.status === "active");

      // idempotent: اگر قبلاً آزاد بوده
      if (!wasActive) {
        return {
          activeDevices: Math.max(0, active),
          maxDevices,
          deviceId,
          alreadyReleased: true,
          isUsed: Math.max(0, active) >= maxDevices,
        };
      }

      // آزاد کردن زیر codes/{codeId}/devices
      tx.set(
        codeDevRef,
        { isActive: false, status: "released", releasedAt: now },
        { merge: true }
      );

      // کاهش شمارنده و ثبت تاریخ
      const newActive = Math.max(0, active - 1);
      tx.update(codeRef, {
        activeDevices: newActive,
        lastDeviceReleasedAt: now,
        maxDevices, // همسوسازی متادیتا برای UI
      });

      // آینه در users/{uid}/devices
      tx.set(
        userDevRef,
        { isActive: false, status: "released", lastSeenAt: now },
        { merge: true }
      );

      return {
        activeDevices: newActive,
        maxDevices,
        deviceId,
        alreadyReleased: false,
        isUsed: newActive >= maxDevices,
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
