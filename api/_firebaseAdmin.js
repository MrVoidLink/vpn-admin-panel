// /api/_firebaseAdmin.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  // این مقادیر رو توی Vercel → Project Settings → Environment Variables ست کن
  // FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // اگر \n ها به صورت رشته اومدن، تبدیلشون کنیم
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
