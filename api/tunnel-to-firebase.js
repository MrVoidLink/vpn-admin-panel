// vite-project/api/tunnel-to-firebase.js

import { google } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/datastore'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    // خواندن اطلاعات از محیط
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      return res.status(500).json({ error: 'Missing Firebase credentials in env' });
    }

    // ساخت JWT token
    const client = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: SCOPES,
    });

    await client.authorize();
    const token = await client.getAccessToken();

    // درخواست به Firestore
    const firebaseRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/codes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await firebaseRes.json();
    return res.status(firebaseRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}
