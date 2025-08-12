// api/claim-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) {
      try { body = await req.json?.(); } catch (_) {}
    }
    const { uid, codeId, deviceId, deviceInfo = {} } = body || {};
    if (!uid || !codeId || !deviceId) return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");
      const code = codeSnap.data() || {};

      const deviceLimit = Number(code.deviceLimit ?? 0);
      if (deviceLimit <= 0) throw new Error("INVALID_DEVICE_LIMIT");

      // تاریخ‌ها
      let activatedAt = code.activatedAt;
      const now = admin.firestore.Timestamp.now();
      if (!activatedAt) {
        // احتیاط: اگر قبلش apply نشده باشه، همینجا ست می‌کنیم
        activatedAt = now;
        tx.update(codeRef, { activatedAt });
      }
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        activatedAt.toMillis() + Number(code.duration ?? 0) * 86400000
      );
      if (expiresAt.toMillis() < Date.now()) throw new Error("CODE_EXPIRED");

      // وضعیت ظرفیت
      const active = Number(code.activeDevices ?? 0);

      // وضعیت دیوایس فعلی
      const codeDevSnap = await tx.get(codeDevRef);
      const wasActive = codeDevSnap.exists && !!(codeDevSnap.data() || {}).isActive;

      // اگر همین دستگاه قبلاً active بوده، idempotent برگرد
      if (wasActive) {
        return {
          activeDevices: active,
          maxDevices: deviceLimit,
          deviceId,
          alreadyActive: true,
        };
      }

      // اگر ظرفیت پر است، اجازه نده
      if (active >= deviceLimit) {
        throw new Error("DEVICE_LIMIT_REACHED");
      }

      // فعال‌سازی دستگاه
      tx.set(
        codeDevRef,
        {
          uid,
          isActive: true,
          claimedAt: now,
          platform: deviceInfo.platform || null,
          model: deviceInfo.model || null,
          appVersion: deviceInfo.appVersion || null,
        },
        { merge: true }
      );

      // افزایش شمارنده
      tx.update(codeRef, {
        activeDevices: active + 1,
        isUsed: active + 1 >= deviceLimit,
        lastDeviceClaimedAt: now,
      });

      // آینه‌ی زیر کاربر
      tx.set(
        userDevRef,
        {
          deviceId,
          uid,
          isActive: true,
          platform: deviceInfo.platform || null,
          model: deviceInfo.model || null,
          appVersion: deviceInfo.appVersion || null,
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSeenAt: now,
        },
        { merge: true }
      );

      return {
        activeDevices: active + 1,
        maxDevices: deviceLimit,
        deviceId,
        alreadyActive: false,
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("claim-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
