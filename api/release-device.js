// api/release-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) {
      try { body = await req.json?.(); } catch (_) {}
    }
    const { uid, codeId, deviceId } = body || {};
    if (!uid || !codeId || !deviceId) return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const [codeSnap, devSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const active = Number(code.activeDevices ?? 0);
      const wasActive = devSnap.exists && !!(devSnap.data() || {}).isActive;

      // اگر قبلاً آزاد شده، idempotent
      if (!wasActive) {
        return { activeDevices: Math.max(0, active), maxDevices: Number(code.deviceLimit ?? 0), deviceId, alreadyReleased: true };
      }

      const now = admin.firestore.Timestamp.now();

      // آزاد کردن دستگاه
      tx.set(codeDevRef, { isActive: false, releasedAt: now }, { merge: true });

      // کاهش شمارنده
      const newActive = Math.max(0, active - 1);
      tx.update(codeRef, {
        activeDevices: newActive,
        isUsed: newActive >= Number(code.deviceLimit ?? 0),
        lastDeviceReleasedAt: now,
      });

      // آینه‌ی زیر کاربر
      tx.set(userDevRef, { isActive: false, lastSeenAt: now }, { merge: true });

      return { activeDevices: newActive, maxDevices: Number(code.deviceLimit ?? 0), deviceId, alreadyReleased: false };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
