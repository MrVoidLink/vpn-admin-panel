// api/release-device.js
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

    const { uid, codeId, deviceId } = req.body || {};
    if (!uid || !codeId || !deviceId) {
      return res.status(400).json({ error: "uid, codeId and deviceId are required" });
    }

    const codeRef = db.collection("codes").doc(codeId);
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    await db.runTransaction(async (tx) => {
      const [codeSnap, codeDevSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const wasActive = codeDevSnap.exists && codeDevSnap.data()?.isActive === true;

      // اگر از قبل آزاد بوده، فقط آینه کاربر را بروزرسانی کن و خارج شو (idempotent)
      if (!wasActive) {
        tx.set(userDevRef, { isActive: false, lastSeenAt: admin.firestore.Timestamp.now() }, { merge: true });
        return;
      }

      // آزاد کردن
      tx.update(codeDevRef, {
        isActive: false,
        releasedAt: admin.firestore.Timestamp.now(),
      });

      const code = codeSnap.data();
      const active = Number(code.activeDevices ?? 0);
      const newActive = Math.max(0, active - 1);

      tx.update(codeRef, {
        activeDevices: newActive,
        isUsed: newActive >= Number(code.maxDevices ?? 0), // اگر هنوز پر است true می‌ماند
        lastDeviceReleasedAt: admin.firestore.Timestamp.now(),
      });

      // آینه کاربر
      tx.set(userDevRef, {
        isActive: false,
        lastSeenAt: admin.firestore.Timestamp.now(),
      }, { merge: true });
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    const map = { CODE_NOT_FOUND: 404 };
    return res.status(map[e.message] || 500).json({ error: e.message || "INTERNAL" });
  }
}
