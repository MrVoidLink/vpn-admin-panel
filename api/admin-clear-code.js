// api/admin-clear-code.js
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
    const { codeId } = req.body || {};
    if (!codeId) return res.status(400).json({ error: 'codeId is required' });

    const codeRef = db.collection('codes').doc(codeId);
    const devsRef = codeRef.collection('devices');

    const now = admin.firestore.Timestamp.now();
    const devsSnap = await devsRef.get();

    // همه دستگاه‌ها را غیر فعال کن (Mirror زیر users هم)
    const CHUNK = 400;
    let cleared = 0;
    const docs = devsSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const batch = db.batch();
      slice.forEach((d) => {
        const data = d.data() || {};
        batch.set(devsRef.doc(d.id), { isActive: false, active: false, releasedAt: now }, { merge: true });
        if (data.uid) {
          const uref = db.collection('users').doc(data.uid).collection('devices').doc(d.id);
          batch.set(uref, { isActive: false, active: false, lastSeenAt: now }, { merge: true });
        }
      });
      await batch.commit();
      cleared += slice.length;
    }

    // فعال/غیرفعال شدن و تاریخ‌های کد را **دست نمی‌زنیم**
    return res.status(200).json({ ok: true, clearedDevices: cleared });
  } catch (e) {
    console.error('admin-clear-code error:', e);
    return res.status(500).json({ error: e.message || 'INTERNAL' });
  }
}
