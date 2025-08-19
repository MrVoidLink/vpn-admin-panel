// api/get-user-summary.js

import { NextResponse } from 'next/server';
import { adminDB, initFirebaseAdmin } from './firebase-admin.config.js';

export async function POST(req) {
  try {
    await initFirebaseAdmin();
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const userRef = adminDB.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    // دستگاه‌ها
    const devicesSnap = await userRef.collection('devices').get();
    const devices = devicesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      ...userData,
      devices,
    });
  } catch (err) {
    console.error('[get-user-summary] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
