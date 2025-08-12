// api/claim-device.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { uid, codeId, deviceId, deviceInfo = {} } = req.body || {};
    if (!uid || !codeId || !deviceId) {
      return res.status(400).json({ error: "uid, codeId and deviceId are required" });
    }

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    let result = { activeDevices: null, maxDevices: null };

    await db.runTransaction(async (tx) => {
      const [codeSnap, codeDevSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const max = Number(code.maxDevices ?? code.remainingDevices ?? code.deviceLimit ?? 1);
      const active = Number(code.activeDevices ?? 0);
      result.maxDevices = max;

      // اگر قبلاً همین دستگاه فعال بوده → ایدمپوتنت: فقط متادیتا آپدیت
      if (codeDevSnap.exists && codeDevSnap.data()?.isActive) {
        tx.update(codeDevRef, {
          ...deviceInfo,
          uid,
          isActive: true,
          active: true, // legacy sync
          lastSeenAt: admin.firestore.Timestamp.now(),
        });
        tx.set(
          userDevRef,
          {
            deviceId,
            ...deviceInfo,
            isActive: true,
            active: true, // legacy sync
            lastSeenAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );
        result.activeDevices = active;
        return;
      }

      // ظرفیت پر؟
      if (active >= max) throw new Error("DEVICE_LIMIT_REACHED");

      // فعال‌سازی این دستگاه
      const now = admin.firestore.Timestamp.now();
      tx.set(
        codeDevRef,
        {
          uid,
          deviceId,
          ...deviceInfo,
          isActive: true,
          active: true, // legacy sync
          claimedAt: now,
          lastSeenAt: now,
        },
        { merge: true }
      );

      // افزایش شمارنده
      tx.update(codeRef, {
        activeDevices: admin.firestore.FieldValue.increment(1),
        isUsed: active + 1 >= max,
        lastDeviceClaimedAt: now,
      });

      // آینه در پروفایل کاربر
      tx.set(
        userDevRef,
        {
          deviceId,
          ...deviceInfo,
          isActive: true,
          active: true, // legacy sync
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSeenAt: now,
        },
        { merge: true }
      );

      result.activeDevices = active + 1;
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const map = {
      CODE_NOT_FOUND: 404,
      DEVICE_LIMIT_REACHED: 409,
    };
    return res.status(map[e.message] || 500).json({ error: e.message || "INTERNAL" });
  }
}
