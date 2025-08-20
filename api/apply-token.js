// /api/apply-token.js
import { db, FieldValue, Timestamp } from './_firebaseAdmin.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}
async function findTokenRefByAny(token) {
  const code = String(token).trim();

  // 1) docId = token
  const directRef = db.collection('tokens').doc(code);
  const directSnap = await directRef.get();
  if (directSnap.exists) return { ref: directRef, snap: directSnap };

  // 2) where code == token
  const q = await db.collection('tokens').where('code', '==', code).limit(1).get();
  if (!q.empty) {
    const doc = q.docs[0];
    return { ref: doc.ref, snap: doc };
  }
  return { ref: null, snap: null };
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

    // === find token by docId or code field ===
    const found = await findTokenRefByAny(token);
    if (!found.ref || !found.snap) {
      return res.status(404).json({ ok: false, error: 'Token not found' });
    }

    const tokenRef = found.ref;
    const tokenSnap = await tokenRef.get();
    const data = tokenSnap.data() || {};
    const {
      type,
      durationDays,
      maxDevices,
      devices = [],
      isActive = true,
      used = false,
      expiresAt,
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

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    let currentExpiry = null;
    if (userSnap.exists) {
      const u = userSnap.data() || {};
      if (u.subscription?.expiry?.toDate) currentExpiry = u.subscription.expiry.toDate();
    }

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
