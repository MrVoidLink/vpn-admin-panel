// بالا:
import { db, FieldValue, Timestamp } from './_firebaseAdmin.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

// 🔎 جست‌وجوی منعطف
async function findTokenRefByAny(tokenRaw) {
  const code = String(tokenRaw || '').trim();
  if (!code) return { ref: null, snap: null, where: 'empty' };

  // نرمال‌سازی ساده: حروف بزرگ/کوچک
  const variants = [code, code.toUpperCase(), code.toLowerCase()];

  // کالکشن‌هایی که چک می‌کنیم
  const collections = ['tokens', 'codes'];

  // 1) تلاش با docId برابر با هر واریانت
  for (const coll of collections) {
    for (const v of variants) {
      const ref = db.collection(coll).doc(v);
      const snap = await ref.get();
      if (snap.exists) return { ref, snap, where: `docId:${coll}/${v}` };
    }
  }

  // 2) تلاش با فیلدهای رایج
  const fields = ['code', 'token', 'value'];
  for (const coll of collections) {
    for (const f of fields) {
      const q = await db.collection(coll).where(f, '==', code).limit(1).get();
      if (!q.empty) {
        const doc = q.docs[0];
        return { ref: doc.ref, snap: doc, where: `field:${coll}.${f}` };
      }
      // یک‌بار هم با upper/lower تست کن
      const q2 = await db.collection(coll).where(f, '==', code.toUpperCase()).limit(1).get();
      if (!q2.empty) {
        const doc = q2.docs[0];
        return { ref: doc.ref, snap: doc, where: `field:${coll}.${f}.upper` };
      }
      const q3 = await db.collection(coll).where(f, '==', code.toLowerCase()).limit(1).get();
      if (!q3.empty) {
        const doc = q3.docs[0];
        return { ref: doc.ref, snap: doc, where: `field:${coll}.${f}.lower` };
      }
    }
  }
  return { ref: null, snap: null, where: 'not-found' };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { uid, token, deviceId } = req.body || {};
    if (!uid || !token || !deviceId) {
      return res.status(400).json({ ok: false, error: 'uid, token, deviceId are required' });
    }

    // ✅ پروژه‌ای که وصل شدیم (برای دیباگ mismatch)
    console.log('apply-token projectId:', process.env.FIREBASE_PROJECT_ID, 'incoming token:', token);

    // 🔎 پیدا کردن توکن
    const found = await findTokenRefByAny(token);
    if (!found.ref || !found.snap) {
      console.warn('Token search MISS where=', found.where, 'token=', token);
      return res.status(404).json({ ok: false, error: 'Token not found' });
    }
    console.log('Token search HIT where=', found.where);

    const tokenRef = found.ref;
    const data = (await tokenRef.get()).data() || {};
    const {
      type, durationDays, maxDevices,
      devices = [], isActive = true, used = false, expiresAt,
    } = data;

    if (!isActive) return res.status(400).json({ ok: false, error: 'Token is inactive' });
    if (!durationDays || !type) return res.status(400).json({ ok: false, error: 'Token config invalid' });
    if (expiresAt?.toDate && expiresAt.toDate() < new Date()) {
      return res.status(400).json({ ok: false, error: 'Token expired' });
    }

    const now = new Date();
    const already = Array.isArray(devices) ? devices.find(d => d.deviceId === deviceId) : null;

    if (!already && typeof maxDevices === 'number' && Array.isArray(devices) && devices.length >= maxDevices) {
      return res.status(409).json({ ok: false, error: 'No device slots left' });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const currentExpiry = userSnap.exists && userSnap.data()?.subscription?.expiry?.toDate
      ? userSnap.data().subscription.expiry.toDate()
      : null;

    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(base.getTime());
    newExpiry.setDate(newExpiry.getDate() + Number(durationDays));

    const deviceEntry = {
      deviceId, uid,
      linkedAt: Timestamp.fromDate(now),
      lastActiveAt: Timestamp.fromDate(now),
    };

    const batch = db.batch();
    if (!already) {
      batch.update(tokenRef, {
        devices: FieldValue.arrayUnion(deviceEntry),
        used: (maxDevices === 1) ? true : (used ?? false),
        updatedAt: Timestamp.now(),
      });
    } else {
      const newDevices = devices.map(d =>
        d.deviceId === deviceId ? { ...d, lastActiveAt: Timestamp.fromDate(now) } : d
      );
      batch.update(tokenRef, { devices: newDevices, updatedAt: Timestamp.now() });
    }

    batch.set(
      userRef,
      {
        subscription: {
          plan: type,
          expiry: Timestamp.fromDate(newExpiry),
          lastAppliedAt: Timestamp.fromDate(now),
          sourceToken: String(token).trim(),
        },
        devices: {
          [deviceId]: { active: true, linkedAt: Timestamp.fromDate(now) },
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    await batch.commit();

    const remaining =
      typeof maxDevices === 'number'
        ? Math.max(0, maxDevices - (already ? devices.length : devices.length + 1))
        : null;

    return res.status(200).json({
      ok: true,
      token: String(token).trim(),
      plan: type,
      durationDays,
      user: { uid },
      device: { deviceId },
      remainingSlots: remaining,
      expiryISO: newExpiry.toISOString(),
    });
  } catch (err) {
    console.error('apply-token error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
