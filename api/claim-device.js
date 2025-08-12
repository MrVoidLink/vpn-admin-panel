// api/claim-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) { try { body = await req.json?.(); } catch (_) {} }
    const { uid, codeId, deviceId, deviceInfo = {} } = body || {};
    if (!uid || !codeId || !deviceId)
      return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");
      const code = codeSnap.data() || {};

      const maxDevices = Number(code.maxDevices ?? 0);
      const validForDays = Number(code.validForDays ?? 0);
      if (!maxDevices || !validForDays) throw new Error("INVALID_CODE_META");

      const now = admin.firestore.Timestamp.now();

      // تاریخ‌ها: اگر اولین بار است، همینجا فعال کنیم
      let activatedAt = code.activatedAt || now;
      let expiresAt = code.expiresAt
        || admin.firestore.Timestamp.fromMillis(activatedAt.toMillis() + validForDays * 86400000);

      // انقضا
      if (expiresAt.toMillis() <= Date.now()) throw new Error("CODE_EXPIRED");

      // ظرفیت
      const active = Number(code.activeDevices ?? 0);

      // وضعیت دستگاه فعلی
      const codeDevSnap = await tx.get(codeDevRef);
      const wasActive = codeDevSnap.exists && !!(codeDevSnap.data() || {}).isActive;

      // اگر قبلاً فعال بوده، idempotent
      if (wasActive) {
        // تضمین ذخیره‌شدن تاریخ‌ها اگر قبلاً null بودند
        if (!code.activatedAt || !code.expiresAt) {
          tx.set(codeRef, { activatedAt, expiresAt }, { merge: true });
        }
        return {
          activeDevices: active,
          maxDevices,
          deviceId,
          alreadyActive: true,
          isUsed: active >= maxDevices,
          expiresAt: expiresAt.toDate(),
        };
      }

      if (active >= maxDevices) throw new Error("DEVICE_LIMIT_REACHED");

      // فعال‌سازی دستگاه زیر codes/{codeId}/devices
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

      // به‌روزرسانی سند کُد
      tx.set(
        codeRef,
        {
          activeDevices: active + 1,
          lastDeviceClaimedAt: now,
          activatedAt: code.activatedAt || activatedAt,
          expiresAt: code.expiresAt || expiresAt,
          maxDevices,     // همسوسازی متادیتا
          validForDays,
        },
        { merge: true }
      );

      // آینه در users/{uid}/devices
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
        maxDevices,
        deviceId,
        alreadyActive: false,
        isUsed: active + 1 >= maxDevices,
        expiresAt: expiresAt.toDate(),
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("claim-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
