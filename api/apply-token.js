// /api/apply-token.js
import { db, FieldValue, Timestamp } from './_firebaseAdmin.js';

// اگر بعداً خواستی با کلید حفاظت کنی، اینو فعال کن
// const APP_TO_API_KEY = process.env.APP_TO_API_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // درصورت نیاز دامنه‌ات رو جایگزین کن
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    // اگر خواستی کلید رو فعال کنی:
    // if (req.headers['x-api-key'] !== APP_TO_API_KEY) {
    //   return res.status(401).json({ ok: false, error: 'Unauthorized' });
    // }

    const { uid, token, deviceId } = req.body || {};
    if (!uid || !token || !deviceId) {
      return res.status(400).json({ ok: false, error: 'uid, token, deviceId are required' });
    }

    // === خواندن توکن ===
    // حالت پیش‌فرض: آیدی داکیومنت = خودِ token
    const tokenRef = db.collection('tokens').doc(String(token).trim());
    const tokenSnap = await tokenRef.get();

    // اگر در دیتابیس‌ت فیلدی به نام "code" داری و docId=token نیست، از این الگو استفاده کن:
    // const q = await db.collection('tokens').where('code', '==', String(token).trim()).limit(1).get();
    // if (q.empty) return res.status(404).json({ ok: false, error: 'Token not found' });
    // const tokenRef = q.docs[0].ref;
    // const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Token not found' });
    }

    const data = tokenSnap.data() || {};
    const {
      type,              // 'premium' | 'gift'
      durationDays,      // 15 | 30 | 60 | 90
      maxDevices,        // ظرفیت دستگاه‌های مجاز
      devices = [],      // [{deviceId, uid, linkedAt, lastActiveAt}]
      isActive = true,   // فعال بودن توکن
      used = false,      // برای مدل‌های تک‌دستگاه
      expiresAt,         // اختیاری: انقضای خودِ توکن
    } = data;

    if (!isActive) return res.status(400).json({ ok: false, error: 'Token is inactive' });
    if (!durationDays || !type) {
      return res.status(400).json({ ok: false, error: 'Token config invalid' });
    }
    if (expiresAt && expiresAt.toDate && expiresAt.toDate() < new Date()) {
      return res.status(400).json({ ok: false, error: 'Token expired' });
    }

    // اگر قبلاً همین deviceId وصل شده، idempotent: همون پاسخ موفق بده
    const already = Array.isArray(devices) ? devices.find(d => d.deviceId === deviceId) : null;

    // ظرفیت
    if (!already && typeof maxDevices === 'number' && Array.isArray(devices) && devices.length >= maxDevices) {
      return res.status(409).json({ ok: false, error: 'No device slots left' });
    }

    // === آپدیت اشتراک کاربر ===
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const now = new Date();

    // expiry فعلی کاربر (اگر وجود داشته باشه)
    let currentExpiry = null;
    if (userSnap.exists) {
      const u = userSnap.data() || {};
      if (u.subscription?.expiry?.toDate) {
        currentExpiry = u.subscription.expiry.toDate();
      }
    }

    // تمدید از بزرگ‌ترِ (الان، expiry فعلی)
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
      // فقط lastActiveAt را به‌روز کن
      const newDevices = devices.map(d =>
        d.deviceId === deviceId ? { ...d, lastActiveAt: Timestamp.fromDate(now) } : d
      );
      batch.update(tokenRef, {
        devices: newDevices,
        updatedAt: Timestamp.now(),
      });
    }

    // آپدیت کاربر
    batch.set(
      userRef,
      {
        subscription: {
          plan: type, // 'premium' | 'gift'
          expiry: Timestamp.fromDate(newExpiry),
          lastAppliedAt: Timestamp.fromDate(now),
          sourceToken: String(token).trim(),
        },
        devices: {
          [deviceId]: {
            active: true,
            linkedAt: Timestamp.fromDate(now),
          },
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
