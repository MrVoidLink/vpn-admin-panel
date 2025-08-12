// api/apply-token.js
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
    const { uid, codeId } = req.body || {};
    if (!uid || !codeId) return res.status(400).json({ error: "uid and codeId are required" });

    const userRef = db.collection("users").doc(uid);
    const codeRef = db.collection("codes").doc(codeId);
    const redemptionRef = codeRef.collection("redemptions").doc(uid);

    await db.runTransaction(async (tx) => {
      const [userSnap, codeSnap, redemptionSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(codeRef),
        tx.get(redemptionRef),
      ]);

      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");
      if (redemptionSnap.exists) throw new Error("ALREADY_REDEEMED_BY_USER");

      const user = userSnap.data() || {};
      const code = codeSnap.data() || {};

      // سازگاری با قدیمی‌ها
      const validForDays = Number(code.validForDays ?? code.duration ?? 30);
      const now = admin.firestore.Timestamp.now();
      const nowMs = now.toMillis();

      // تمدید هوشمند
      const existingExpires = user?.subscription?.expiresAt;
      const existingMs = existingExpires
        ? (existingExpires.toMillis ? existingExpires.toMillis() : existingExpires.seconds * 1000)
        : 0;
      const baseMs = existingMs > nowMs ? existingMs : nowMs;
      const newExpiresAt = admin.firestore.Timestamp.fromMillis(
        baseMs + validForDays * 24 * 60 * 60 * 1000
      );

      // آپدیت کاربر (بدون کم‌کردن ظرفیت)
      tx.update(userRef, {
        planType: code.type === "premium" ? "premium" : "gift",
        tokenId: codeId,
        subscription: {
          startAt: user?.subscription?.startAt ?? now,
          activatedAt: now,
          expiresAt: newExpiresAt,
          source: code.source || "unknown",
          codeId,
        },
        status: "active",
      });

      // لاگ مصرف (برای جلوگیری از apply دوباره توسط همین uid)
      tx.set(redemptionRef, {
        uid,
        redeemedAt: now,
        source: code.source || "unknown",
      });
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    const map = {
      USER_NOT_FOUND: 404,
      CODE_NOT_FOUND: 404,
      ALREADY_REDEEMED_BY_USER: 409,
    };
    return res.status(map[e.message] || 500).json({ error: e.message || "INTERNAL" });
  }
}
