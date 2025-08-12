// api/apply-token.js
import { db } from "./firebase-admin.config.js";
import { Timestamp } from "firebase-admin/firestore";

// بدنه‌ی درخواست را مطمئن بخوان (چه vercel dev چه vite proxy)
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // توسط ورسل پارس شده
  try {
    // اگر بدنه استریم خام بود
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8") || "";
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { uid, codeId } = await readJsonBody(req);
    if (!uid || !codeId) return res.status(400).json({ error: "uid_and_code_required" });

    const codeRef = db.collection("codes").doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) return res.status(404).json({ error: "CODE_NOT_FOUND" });

    const code = codeSnap.data() || {};
    const validForDays = Number(code.validForDays ?? 0);
    const maxDevices  = Number(code.maxDevices ?? 0);
    const type        = code.type || "premium";
    if (!validForDays || !maxDevices) return res.status(400).json({ error: "INVALID_CODE_META" });

    const now = Timestamp.now();
    const activatedAt = code.activatedAt ?? now;
    const expiresAt = code.expiresAt
      ?? Timestamp.fromMillis(activatedAt.toMillis() + validForDays * 24 * 60 * 60 * 1000);

    if (expiresAt.toMillis() <= Date.now()) {
      return res.status(400).json({ error: "CODE_EXPIRED" });
    }

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      // تثبیت متادیتای کُد (فقط v2)
      tx.set(
        codeRef,
        { type, validForDays, maxDevices, activatedAt, expiresAt },
        { merge: true }
      );

      // تنظیم اشتراک کاربر
      tx.set(
        userRef,
        {
          tokenId: codeId,
          planType: type === "gift" ? "gift" : "premium",
          status: "active",
          subscription: {
            source: code.source || "admin",
            codeId,
            expiresAt,
          },
        },
        { merge: true }
      );

      // لاگ
      tx.set(codeRef.collection("redemptions").doc(uid), {
        uid,
        action: "apply",
        appliedAt: now,
      });
    });

    return res.status(200).json({
      ok: true,
      codeId,
      validForDays,
      maxDevices,
      activatedAt: activatedAt.toDate(),
      expiresAt: expiresAt.toDate(),
    });
  } catch (e) {
    console.error("apply-token error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
