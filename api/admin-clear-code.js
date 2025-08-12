// api/admin-clear-code.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const { codeId } = req.body || {};
    if (!codeId) return res.status(400).json({ error: "codeId is required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) return res.status(404).json({ error: "CODE_NOT_FOUND" });

    const devsRef = codeRef.collection("devices");
    const devsSnap = await devsRef.get();

    // کار روی گروه‌های 200تایی برای مطمئن بودن از محدودیت‌ها
    const chunks = [];
    const docs = devsSnap.docs;
    for (let i = 0; i < docs.length; i += 200) chunks.push(docs.slice(i, i + 200));

    let cleared = 0;
    for (const chunk of chunks) {
      await db.runTransaction(async (tx) => {
        const now = admin.firestore.Timestamp.now();
        chunk.forEach((d) => {
          const data = d.data() || {};
          const dref = devsRef.doc(d.id);
          tx.set(
            dref,
            { isActive: false, active: false, releasedAt: now },
            { merge: true }
          );

          // آینهٔ کاربر
          if (data.uid) {
            const userDevRef = db.collection("users").doc(data.uid).collection("devices").doc(d.id);
            tx.set(userDevRef, { isActive: false, active: false, lastSeenAt: now }, { merge: true });
          }
        });

        tx.update(codeRef, {
          activeDevices: 0,
          isUsed: false,
          lastDeviceReleasedAt: admin.firestore.Timestamp.now(),
        });
      });
      cleared += chunk.length;
    }

    return res.status(200).json({ ok: true, clearedDevices: cleared });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "INTERNAL" });
  }
}
