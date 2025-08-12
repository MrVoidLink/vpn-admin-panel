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

// fallback: read JSON body when req.body is undefined (Vite dev)
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  console.log('[admin-reset-user] called', req.method, req.url);
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const body = await readJsonBody(req);
    console.log('[admin-reset-user] body:', body);

    const { uid, alsoRemoveRedemption = true } = body || {};
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const user = userSnap.data() || {};
    const codeId = user.tokenId;
    console.log('[admin-reset-user] tokenId:', codeId);

    // اگر کاربر کد ندارد، فقط پروفایل ریست می‌شود
    if (!codeId) {
      await userRef.update({
        planType: 'free',
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
        status: 'active',
      });
      const now = admin.firestore.Timestamp.now();
      const udevs = await userRef.collection('devices').get();
      await Promise.all(
        udevs.docs.map((d) =>
          userRef.collection('devices').doc(d.id).set(
            { isActive: false, active: false, lastSeenAt: now },
            { merge: true }
          )
        )
      );
      return res.status(200).json({ ok: true, clearedDevices: 0 });
    }

    const codeRef = db.collection('codes').doc(codeId);
    const devsRef = codeRef.collection('devices');

    // همه دستگاه‌های فعال این کاربر روی این کد
    const activeByUserSnap = await devsRef
      .where('uid', '==', uid)
      .where('isActive', '==', true)
      .get();
    const activeCount = activeByUserSnap.size;
    console.log('[admin-reset-user] activeByUser:', activeCount);

    // دستگاه‌های کاربر (برای آینه)
    const userDevsSnap = await userRef.collection('devices').get();

    await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error('CODE_NOT_FOUND');

      const code = codeSnap.data() || {};
      const active = Number(code.activeDevices ?? 0);
      const max = Number(code.maxDevices ?? code.deviceLimit ?? 0);
      const now = admin.firestore.Timestamp.now();

      // آزاد کردن دستگاه‌های کاربر
      activeByUserSnap.docs.forEach((docSnap) => {
        tx.set(
          devsRef.doc(docSnap.id),
          { isActive: false, active: false, releasedAt: now },
          { merge: true }
        );
      });

      const newActive = Math.max(0, active - activeCount);
      tx.update(codeRef, {
        activeDevices: newActive,
        isUsed: newActive >= max,
        lastDeviceReleasedAt: now,
      });

      // ریست پروفایل کاربر
      tx.update(userRef, {
        planType: 'free',
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
        status: 'active',
      });

      // آینه‌ی devices زیر users/{uid}
      userDevsSnap.docs.forEach((ud) => {
        tx.set(
          userRef.collection('devices').doc(ud.id),
          { isActive: false, active: false, lastSeenAt: now },
          { merge: true }
        );
      });

      // حذف redemption برای تست مجدد (اختیاری)
      if (alsoRemoveRedemption) {
        tx.delete(codeRef.collection('redemptions').doc(uid));
      }
    });

    return res.status(200).json({ ok: true, clearedDevices: activeCount, codeId });
  } catch (e) {
    console.error('admin-reset-user error:', e);
    return res.status(500).json({ error: e.message || 'INTERNAL' });
  }
}
