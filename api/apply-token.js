// api/apply-token.js
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

const addDays = (date, days) => {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { uid, codeId } = req.body || {};
    if (!uid || !codeId) return res.status(400).json({ error: 'uid and codeId are required' });

    const codeRef = db.collection('codes').doc(codeId);
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (tx) => {
      const [codeSnap, userSnap] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
      if (!codeSnap.exists) throw new Error('CODE_NOT_FOUND');
      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

      const code = codeSnap.data() || {};

      // پشتیبانی از هر دو اسکیمای قدیم/جدید
      const validForDays =
        Number(code.validForDays ?? code.duration ?? 0);
      const deviceLimit =
        Number(code.remainingDevices ?? code.deviceLimit ?? 0);

      if (!validForDays || !deviceLimit) throw new Error('INVALID_CODE_META');

      const now = admin.firestore.Timestamp.now();

      // اولین بار: فقط اگر activatedAt خالی است ست می‌کنیم
      let updates = {};
      if (!code.activatedAt) {
        const expiresJs = addDays(now.toDate(), validForDays);
        updates.activatedAt = now;
        updates.expiresAt = admin.firestore.Timestamp.fromDate(expiresJs);
      }

      // آینه redemption برای کاربر (کمک به لاگ/سابقه)
      tx.set(codeRef.collection('redemptions').doc(uid), {
        uid,
        appliedAt: now,
      }, { merge: true });

      // وضعیت کد
      updates.isUsed = true;
      tx.set(codeRef, updates, { merge: true });

      // به کاربر لینک بده
      const planType = String(code.type || 'premium');
      tx.set(userRef, {
        planType,
        tokenId: codeId,
        subscription: {
          source: code.source || 'admin',
          codeId,
          // فقط برای نمایش؛ تکیه اصلی روی خود code است
          expiresAt: updates.expiresAt ?? code.expiresAt ?? null,
        },
        status: 'active',
      }, { merge: true });
    });

    return res.status(200).json({ ok: true, codeId });
  } catch (e) {
    console.error('apply-token error:', e);
    const msg = e.message || 'INTERNAL';
    const status = (msg === 'INVALID_CODE_META') ? 400
                 : (msg.includes('NOT_FOUND') ? 404 : 500);
    return res.status(status).json({ error: msg });
  }
}
