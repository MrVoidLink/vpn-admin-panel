// api/apply-token.js
import { db } from './firebase-admin.config.js'; // ← مطابق ساختار پروژه‌ی فعلی
import admin from 'firebase-admin';

const { FieldValue, Timestamp } = admin.firestore;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

// ترتیب جست‌وجو: اول codes (الگوی قدیمی)، بعد tokens
const COLLECTIONS = [
  process.env.TOKENS_COLLECTION_PRIMARY || 'codes',
  process.env.TOKENS_COLLECTION_FALLBACK || 'tokens',
];
// فیلدهای محتمل برای ذخیره‌ی خودِ کُد
const CODE_FIELDS = [
  process.env.TOKEN_CODE_FIELD || 'code',
  'token',
  'value',
];

function norm(raw) {
  return String(raw || '').trim();
}

// بدنه‌ی JSON را مطمئن بخوان (برای vercel dev/vite proxy)
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8') || '';
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

async function findTokenRef(rawToken) {
  const code = norm(rawToken);
  if (!code) return { ref: null, where: 'empty' };

  const variants = [code, code.toUpperCase(), code.toLowerCase()];

  // 1) تلاش با DocID
  for (const coll of COLLECTIONS) {
    for (const v of variants) {
      const ref = db.collection(coll).doc(v);
      const snap = await ref.get();
      if (snap.exists) return { ref, where: `docId:${coll}/${v}` };
    }
  }

  // 2) تلاش با فیلدهای رایج (code/token/value)
  for (const coll of COLLECTIONS) {
    for (const field of CODE_FIELDS) {
      for (const v of variants) {
        const q = await db.collection(coll).where(field, '==', v).limit(1).get();
        if (!q.empty) {
          const doc = q.docs[0];
          return { ref: doc.ref, where: `field:${coll}.${field}=${v}` };
        }
      }
    }
  }

  return { ref: null, where: 'not-found' };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { uid, token, deviceId } = body || {};
    if (!uid || !token || !deviceId) {
      return res.status(400).json({ ok: false, error: 'uid, token, deviceId are required' });
    }

    // لاگ تشخیصی واضح
    console.log('[apply-token] pid=', process.env.FIREBASE_PROJECT_ID,
      'collections=', COLLECTIONS, 'fields=', CODE_FIELDS, 'incoming=', token);

    // پیدا کردن توکن دقیقاً با منطق بالا
    const found = await findTokenRef(token);
    if (!found.ref) {
      console.warn('[apply-token] MISS where=', found.where, 'token=', token);
      return res.status(404).json({ ok: false, error: 'Token not found' });
    }
    console.log('[apply-token] HIT where=', found.where);

    const tokenRef = found.ref;
    const snap = await tokenRef.get();
    const data = snap.data() || {};

    const {
      type,              // 'premium' | 'gift'
      durationDays,      // 15 | 30 | 60 | 90
      maxDevices,        // Number
      devices = [],      // Array<{deviceId, uid, linkedAt, lastActiveAt}>
      isActive = true,   // Boolean
      used = false,      // Boolean
      expiresAt,         // Timestamp?
    } = data;

    if (!isActive) return res.status(400).json({ ok: false, error: 'Token is inactive' });
    if (!durationDays || !type) {
      return res.status(400).json({ ok: false, error: 'Token config invalid' });
    }
    if (expiresAt?.toDate && expiresAt.toDate() < new Date()) {
      return res.status(400).json({ ok: false, error: 'Token expired' });
    }

    const now = new Date();
    const already = Array.isArray(devices) ? devices.find(d => d.deviceId === deviceId) : null;

    if (!already && typeof maxDevices === 'number' && Array.isArray(devices) && devices.length >= maxDevices) {
      return res.status(409).json({ ok: false, error: 'No device slots left' });
    }

    // تمدید اشتراک کاربر (از expiry فعلی یا الان + durationDays)
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    const currentExpiry = userSnap.exists && userSnap.data()?.subscription?.expiry?.toDate
      ? userSnap.data().subscription.expiry.toDate()
      : null;

    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(base.getTime());
    newExpiry.setDate(newExpiry.getDate() + Number(durationDays));

    const deviceEntry = {
      deviceId,
      uid,
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
          sourceToken: norm(token),
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
      token: norm(token),
      plan: type,
      durationDays,
      user: { uid },
      device: { deviceId },
      remainingSlots: remaining,
      expiryISO: newExpiry.toISOString(),
    });
  } catch (err) {
    console.error('[apply-token] error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
