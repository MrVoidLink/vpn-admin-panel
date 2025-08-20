// /api/get-user-summary.js
import { db, Timestamp } from './_firebaseAdmin.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

function pickInput(req) {
  // از POST body یا از querystring
  if (req.method === 'GET') {
    const { uid, deviceId } = req.query || {};
    return { uid, deviceId };
  }
  const { uid, deviceId } = req.body || {};
  return { uid, deviceId };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { uid, deviceId } = pickInput(req);
    if (!uid || !deviceId) {
      return res.status(400).json({ ok: false, error: 'uid, deviceId are required' });
    }

    // --- user
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const sub = user.subscription || {};
    const expiryISO =
      sub.expiry?.toDate ? sub.expiry.toDate().toISOString() : null;

    // دستگاه‌های کاربر (اختیاری)
    const userDevices = user.devices || {};

    // --- توکن‌های حاوی این deviceId (برای نشان دادن وضعیت ظرفیت)
    const tokensWithThisDevice = await db
      .collection('tokens')
      .where('devices', 'array-contains', { deviceId }) // این کار نمی‌کند چون object exact match می‌خواهد
      .limit(1)
      .get()
      .catch(() => null);

    // نکته: array-contains روی object exact match سخت است.
    // پس یک Query جایگزین (اگر index داری) بهتر است، اما برای خلاصه، فقط از user و فیلدهایش می‌خوانیم.

    return res.status(200).json({
      ok: true,
      subscription: {
        plan: sub.plan || null,
        expiryISO,
      },
      device: {
        deviceId,
        active: Boolean(userDevices?.[deviceId]?.active),
        linkedAtISO: userDevices?.[deviceId]?.linkedAt?.toDate
          ? userDevices[deviceId].linkedAt.toDate().toISOString()
          : null,
      },
      // می‌تونی بعداً remainingSlots و ... را هم از apply-token جواب آخرین درخواست نگه‌داری کنی
    });
  } catch (err) {
    console.error('get-user-summary error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
