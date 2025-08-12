// api/release-device.js
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
    const { uid, codeId, deviceId } = req.body || {};
    if (!uid || !codeId || !deviceId) return res.status(400).json({ error: 'uid, codeId, deviceId required' });

    const codeRef = db.collection('codes').doc(codeId);
    const userDevRef = db.collection('users').doc(uid).collection('devices').doc(deviceId);
    const codeDevRef = codeRef.collection('devices').doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const [codeSnap, thisDevSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error('CODE_NOT_FOUND');

      const code = codeSnap.data() || {};
      const limit = Number(code.remainingDevices ?? code.deviceLimit ?? 0);
      if (!limit) throw new Error('INVALID_CODE_META');

      const now = admin.firestore.Timestamp.now();

      // اگر دستگاه اصلاً ثبت نبود، idempotent برگرد
      if (!thisDevSnap.exists || !thisDevSnap.data().isActive) {
        const activeSnap = await tx.get(codeRef.collection('devices').where('isActive', '==', true));
        return { activeDevices: activeSnap.size, maxDevices: limit };
      }

      // آزاد کردن
      tx.set(codeDevRef, { isActive: false, active: false, releasedAt: now }, { merge: true });
      tx.set(userDevRef, { isActive: false, active: false, lastSeenAt: now }, { merge: true });

      // شمارش جدید
      const activeSnap = await tx.get(codeRef.collection('devices').where('isActive', '==', true));
      return { activeDevices: activeSnap.size, maxDevices: limit };
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error('release-device error:', e);
    const msg = e.message || 'INTERNAL';
    const status = msg.includes('NOT_FOUND') ? 404 :
                   msg === 'INVALID_CODE_META' ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
}
