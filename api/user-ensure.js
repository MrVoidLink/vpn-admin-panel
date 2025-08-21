// api/user-ensure.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";
const { Timestamp } = admin.firestore;

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
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
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const body = await readJsonBody(req);
    const action = (body.action || "ensure").toString();
    const now = Timestamp.now();

    // حالت ست‌کردن زبان (بدون دست‌زدن به سایر فیلدها)
    if (action === "setLanguage") {
      const { uid, language } = body || {};
      if (!uid || !language) return res.status(400).json({ error: "uid and language are required" });
      await db.collection("users").doc(uid).set(
        { language, lastSeenAt: now },
        { merge: true }
      );
      return res.status(200).json({ ok: true, mode: "setLanguage" });
    }

    // حالت پیش‌فرض: ensure
    const {
      uid,
      language,   // اختیاری
      appVersion,
      platform,
      deviceModel,
      extra = {},
    } = body || {};

    if (!uid || !appVersion || !platform || !deviceModel) {
      return res.status(400).json({ error: "uid, appVersion, platform, deviceModel are required" });
    }

    const userRef = db.collection("users").doc(uid);

    // فقط اگر language آمده باشد، ستش می‌کنیم
    const payload = {
      appVersion,
      platform,
      deviceModel,
      lastSeenAt: now,
      ...(language ? { language } : {}),
      ...extra,
    };

    await userRef.set(
      {
        ...payload,
        createdAt: now, // اگر قبلاً بوده، با merge دست‌نخورده می‌ماند
        subscription: {
          plan: "free",
          type: "free",
          startedAt: now,
          expiresAt: null,
          ...(extra.subscription || {}),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, mode: "ensure" });
  } catch (e) {
    console.error("user-ensure error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
