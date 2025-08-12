// api/apply-token.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) {
      try { body = await req.json?.(); } catch (_) {}
    }
    const { uid, codeId } = body || {};
    if (!uid || !codeId) return res.status(400).json({ error: "uid and codeId are required" });

    const userRef = db.collection("users").doc(uid);
    const codeRef = db.collection("codes").doc(codeId);
    const redemptionRef = codeRef.collection("redemptions").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");
      const code = codeSnap.data() || {};
      const durationDays = Number(code.duration ?? 0);
      const deviceLimit = Number(code.deviceLimit ?? 0);
      if (durationDays <= 0 || deviceLimit <= 0) throw new Error("INVALID_CODE_META");

      // فقط بار اول: activatedAt ست می‌شود
      let activatedAt = code.activatedAt;
      const now = admin.firestore.Timestamp.now();
      if (!activatedAt) {
        activatedAt = now;
        tx.update(codeRef, { activatedAt });
      }

      // محاسبه expiresAt از activatedAt
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        activatedAt.toMillis() + durationDays * 24 * 60 * 60 * 1000
      );

      // اگر تاریخ گذشته باشد، اجازه‌ی apply نمی‌دهیم
      if (expiresAt.toMillis() < Date.now()) {
        throw new Error("CODE_EXPIRED");
      }

      // ثبت ردمپشن این کاربر (idempotent)
      tx.set(
        redemptionRef,
        { uid, redeemedAt: now },
        { merge: true }
      );

      // نگاشت نوع کد به پلن
      const planType = (code.type === "premium" || code.type === "gift") ? "premium" : String(code.type || "premium");

      // آپدیت پروفایل کاربر: activatedAt فقط از کد می‌آید؛ override نمی‌کنیم
      tx.set(
        userRef,
        {
          planType,
          tokenId: codeId,
          subscription: {
            activatedAt,
            expiresAt,
            source: "code",
            codeId,
          },
          status: "active",
        },
        { merge: true }
      );

      return {
        planType,
        activatedAt: activatedAt.toDate().toISOString(),
        expiresAt: expiresAt.toDate().toISOString(),
        durationDays,
        deviceLimit,
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("apply-token error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
