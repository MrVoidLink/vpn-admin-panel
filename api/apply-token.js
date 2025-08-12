// vite-project/api/apply-token.js
import admin from "firebase-admin";

// ——— Initialize Admin SDK (once) ———
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
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { uid, codeId } = req.body || {};
    if (!uid || !codeId) {
      return res.status(400).json({ error: "uid and codeId are required" });
    }

    const userRef = db.collection("users").doc(uid);
    const codeRef = db.collection("codes").doc(codeId);

    await db.runTransaction(async (tx) => {
      const [userSnap, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);

      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data();

      // اعتبارسنجی پایه
      if (code.isUsed) throw new Error("CODE_ALREADY_USED");
      const remaining = Number(code.remainingDevices ?? 0);
      if (remaining <= 0) throw new Error("NO_DEVICES_LEFT");

      const validForDays = Number(code.validForDays ?? 30);
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + validForDays * 24 * 60 * 60 * 1000)
      );

      // آپدیت کاربر
      tx.update(userRef, {
        planType: code.type === "premium" ? "premium" : "gift",
        tokenId: codeId,
        subscription: {
          startAt: now,
          activatedAt: now,
          expiresAt,
          source: code.source || "unknown",
          codeId,
        },
        status: "active",
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(), // اختیاری
      });

      // آپدیت کد
      const newRemaining = remaining - 1;
      tx.update(codeRef, {
        remainingDevices: newRemaining,
        isUsed: newRemaining <= 0,
        lastAppliedAt: now,
      });
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    const status =
      e.message === "USER_NOT_FOUND" ? 404 :
      e.message === "CODE_NOT_FOUND" ? 404 :
      e.message === "CODE_ALREADY_USED" ? 409 :
      e.message === "NO_DEVICES_LEFT" ? 409 : 500;

    return res.status(status).json({ error: e.message || "INTERNAL" });
  }
}
