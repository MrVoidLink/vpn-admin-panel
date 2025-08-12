// api/admin-reset-user.js
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

    // ساده‌ترین محافظت: کلید ادمین
    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const { uid, alsoRemoveRedemption = true } = req.body || {};
    if (!uid) return res.status(400).json({ error: "uid is required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const user = userSnap.data() || {};
    const codeId = user.tokenId;
    if (!codeId) {
      // حتی اگر کاربر کدی نداشته باشد، می‌توانیم فقط اشتراک را ریست کنیم
      await userRef.update({
        planType: "free",
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
      });
      return res.status(200).json({ ok: true, clearedDevices: 0, message: "User had no tokenId; subscription reset." });
    }

    const codeRef = db.collection("codes").doc(codeId);
    const devsRef = codeRef.collection("devices");

    // همهٔ deviceهایی که توسط همین uid روی این کد فعال هستند
    const activeByUserSnap = await devsRef.where("uid", "==", uid).where("isActive", "==", true).get();
    const activeCount = activeByUserSnap.size;

    await db.runTransaction(async (tx) => {
      const [codeSnap] = await Promise.all([tx.get(codeRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");
      const code = codeSnap.data() || {};
      const active = Number(code.activeDevices ?? 0);
      const max = Number(code.maxDevices ?? 0);

      // آزاد کردن همهٔ دستگاه‌های این کاربر زیر این کد
      activeByUserSnap.docs.forEach((docSnap) => {
        const dref = devsRef.doc(docSnap.id);
        tx.update(dref, {
          isActive: false,
          active: false,
          releasedAt: admin.firestore.Timestamp.now(),
        });
      });

      const newActive = Math.max(0, active - activeCount);
      tx.update(codeRef, {
        activeDevices: newActive,
        isUsed: newActive >= max,
        lastDeviceReleasedAt: admin.firestore.Timestamp.now(),
      });

      // ریست کاربر
      tx.update(userRef, {
        planType: "free",
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
        status: "active",
      });

      // آینهٔ دستگاه‌ها در پروفایل کاربر
      const userDevsRef = userRef.collection("devices");
      const userDevsSnap = await userDevsRef.get();
      userDevsSnap.docs.forEach((ud) => {
        tx.set(
          userDevsRef.doc(ud.id),
          { isActive: false, active: false, lastSeenAt: admin.firestore.Timestamp.now() },
          { merge: true }
        );
      });

      // حذف redemption برای تست مجدد (اختیاری)
      if (alsoRemoveRedemption) {
        const redRef = codeRef.collection("redemptions").doc(uid);
        tx.delete(redRef);
      }
    });

    return res.status(200).json({ ok: true, clearedDevices: activeCount, codeId });
  } catch (e) {
    console.error(e);
    const map = { CODE_NOT_FOUND: 404 };
    return res.status(map[e.message] || 500).json({ error: e.message || "INTERNAL" });
  }
}
