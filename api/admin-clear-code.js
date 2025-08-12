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

// read JSON body fallback
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  console.log('[admin-clear-code] called', req.method, req.url);
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { codeId } = await readJsonBody(req);
    console.log('[admin-clear-code] body:', { codeId });

    if (!codeId) return res.status(400).json({ error: 'codeId is required' });

    const codeRef = db.collection('codes').doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) return res.status(404).json({ error: 'CODE_NOT_FOUND' });

    const devsRef = codeRef.collection('devices');
    const devsSnap = await devsRef.get();

    const now = admin.firestore.Timestamp.now();
    const docs = devsSnap.docs;
    const CHUNK = 400;
    let cleared = 0;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const batch = db.batch();

      slice.forEach((d) => {
        const data = d.data() || {};
        // زیر codes/{codeId}/devices
        batch.set(
          devsRef.doc(d.id),
          { isActive: false, active: false, releasedAt: now },
          { merge: true }
        );
        // آینه زیر users/{uid}/devices
        if (data.uid) {
          const userDevRef = db.collection('users').doc(data.uid).collection('devices').doc(d.id);
          batch.set(
            userDevRef,
            { isActive: false, active: false, lastSeenAt: now },
            { merge: true }
          );
        }
      });

      await batch.commit();
      cleared += slice.length;
    }

    await codeRef.update({
      activeDevices: 0,
      isUsed: false,
      lastDeviceReleasedAt: now,
    });

    return res.status(200).json({ ok: true, clearedDevices: cleared });
  } catch (e) {
    console.error('admin-clear-code error:', e);
    return res.status(500).json({ error: e.message || 'INTERNAL' });
  }
}
