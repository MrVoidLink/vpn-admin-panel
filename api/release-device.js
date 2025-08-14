// api/release-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

const LOG_TO_CONSOLE = true; // نمایش لاگ‌ها در کنسول
const LOG_TO_DB = false; // فقط اگر خواستی تو Firestore هم ذخیره بشه true کن

function logIt(step, data) {
  if (LOG_TO_CONSOLE) {
    console.log(`[release-device] ${step}:`, JSON.stringify(data, null, 2));
  }
  // ذخیره در دیتابیس برای دیباگ آنلاین
  if (LOG_TO_DB && data?.codeId) {
    const logRef = db.collection("codes").doc(data.codeId)
      .collection("releaseLogs").doc();
    logRef.set({
      step,
      data,
      at: admin.firestore.FieldValue.serverTimestamp(),
    }).catch((e) => console.error("LOG_TO_DB error", e));
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) { try { body = await req.json?.(); } catch (_) {} }
    const { uid, codeId, deviceId } = body || {};
    logIt("REQ", { uid, codeId, deviceId });

    if (!uid || !codeId || !deviceId)
      return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const now = admin.firestore.Timestamp.now();
      const maxDevices = Number(code.maxDevices ?? 0);
      const active = Number(code.activeDevices ?? 0);

      // پیدا کردن device در زیرمجموعه‌ی کد
      const codeDevsSnap = await codeRef.collection("devices").get();
      const codeDevDoc = codeDevsSnap.docs.find(d => d.id.includes(deviceId));
      if (!codeDevDoc) throw new Error("DEVICE_NOT_FOUND");

      const wasActive = codeDevDoc.exists && !!(codeDevDoc.data() || {}).isActive;
      logIt("TX: chosen dev doc", { id: codeDevDoc.id, wasActive });

      // اگر از قبل آزاد بوده
      if (!wasActive) {
        return {
          activeDevices: Math.max(0, active),
          maxDevices,
          deviceId,
          alreadyReleased: true,
          isUsed: Math.max(0, active) >= maxDevices,
        };
      }

      // آزاد کردن
      tx.set(codeDevDoc.ref, { isActive: false, releasedAt: now }, { merge: true });

      // کاهش شمارنده
      const newActive = Math.max(0, active - 1);
      tx.update(codeRef, {
        activeDevices: newActive,
        lastDeviceReleasedAt: now,
        maxDevices,
      });

      // در user/devices هم غیر فعال کن
      tx.set(userDevRef, { isActive: false, lastSeenAt: now }, { merge: true });

      return {
        activeDevices: newActive,
        maxDevices,
        deviceId,
        alreadyReleased: false,
        isUsed: newActive >= maxDevices,
      };
    });

    logIt("RES 200", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
