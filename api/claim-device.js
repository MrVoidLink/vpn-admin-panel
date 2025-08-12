// api/claim-device.js
import 'dotenv/config';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { uid, codeId, deviceId, deviceInfo = {} } = req.body || {};
    if (!uid || !codeId || !deviceId) return res.status(400).json({ error: 'uid, codeId, deviceId required' });

    const codeRef = db.collection('codes').doc(codeId);
    const userDevRef = db.collection('users').doc(uid).collection('devices').doc(deviceId);
    const codeDevRef = codeRef.collection('devices').doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error('CODE_NOT_FOUND');
      const code = codeSnap.data() || {};

      // خوانش متادیتا به صورت سازگار
      const limit = Number(code.remainingDevices ?? code.deviceLimit ?? 0);
      const expiresAt = code.expiresAt;
      if (!limit) throw new Error('INVALID_CODE_META');
      if (expiresAt && expiresAt.toDate() < new Date()) throw new Error('CODE_EXPIRED');

      // تعداد فعال فعلی را از ساب‌کالکشن بشمار
      const activeSnap = await tx.get(codeRef.collection('devices').where('isActive', '==', true));
      const activeCount = activeSnap.size;

      // اگر همین device قبلاً فعال است، اجازه بده idempotent باشد
      const thisDevSnap = await tx.get(codeDevRef);
      const alreadyActive = thisDevSnap.exists && !!thisDevSnap.data().isActive;

      if (!alreadyActive && activeCount >= limit) throw new Error('DEVICE_LIMIT_REACHED');

      const now = admin.firestore.Timestamp.now();

      // زیر codes/{codeId}/devices
      tx.set(codeDevRef, {
        uid,
        deviceId,
        isActive: true,
        claimedAt: now,
        lastSeenAt: now,
        ...deviceInfo,
      }, { merge: true });

      // آینه زیر users/{uid}/devices
      tx.set(userDevRef, {
        id: deviceId,
        deviceId,
        isActive: true,
        active: true,
        registeredAt: admin.firestore.FieldValue.increment(0) || now, // اگر نبود می‌شود now
        lastSeenAt: now,
        ...deviceInfo,
      }, { merge: true });

      return { activeDevices: alreadyActive ? activeCount : activeCount + 1, maxDevices: limit };
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error('claim-device error:', e);
    const msg = e.message || 'INTERNAL';
    const status =
      msg === 'DEVICE_LIMIT_REACHED' ? 409 :
      msg === 'CODE_EXPIRED' ? 410 :
      msg.includes('NOT_FOUND') ? 404 :
      msg === 'INVALID_CODE_META' ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
}
