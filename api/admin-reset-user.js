// api/admin-reset-user.js
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
    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const user = userSnap.data() || {};
    const codeId = user.tokenId;
    const now = admin.firestore.Timestamp.now();

    if (!codeId) {
      // فقط خود کاربر را ریست کن
      const udevs = await userRef.collection('devices').get();
      const batch = db.batch();
      udevs.docs.forEach((d) => {
        batch.set(d.ref, { isActive: false, active: false, lastSeenAt: now }, { merge: true });
      });
      batch.set(userRef, {
        planType: 'free',
        status: 'active',
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
      }, { merge: true });
      await batch.commit();
      return res.status(200).json({ ok: true, clearedDevices: udevs.size });
    }

    // دستگاه‌های این کاربر روی این کد را آزاد کن
    const codeRef = db.collection('codes').doc(codeId);
    const devsSnap = await codeRef.collection('devices').where('uid', '==', uid).where('isActive', '==', true).get();

    await db.runTransaction(async (tx) => {
      devsSnap.docs.forEach((docSnap) => {
        tx.set(docSnap.ref, { isActive: false, active: false, releasedAt: now }, { merge: true });
      });

      // آینه‌ی زیر users
      const udevs = await tx.get(userRef.collection('devices'));
      udevs.docs.forEach((ud) => {
        tx.set(ud.ref, { isActive: false, active: false, lastSeenAt: now }, { merge: true });
      });

      // پروفایل کاربر به حالت Free
      tx.set(userRef, {
        planType: 'free',
        status: 'active',
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
      }, { merge: true });

      // ❗ تاریخ‌های activatedAt / expiresAt کد دست نمی‌خورد
    });

    return res.status(200).json({ ok: true, clearedDevices: devsSnap.size, codeId });
  } catch (e) {
    console.error('admin-reset-user error:', e);
    return res.status(500).json({ error: e.message || 'INTERNAL' });
  }
}
