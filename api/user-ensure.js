// api/user-ensure.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";
const { Timestamp, FieldValue } = admin.firestore;

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
    const {
      uid,
      language,            // اختیاری
      appVersion,
      platform,
      deviceModel,
      extra = {},          // هر متادیتای دیگری
    } = body || {};

    if (!uid || !appVersion || !platform || !deviceModel) {
      return res.status(400).json({ error: "uid, appVersion, platform, deviceModel are required" });
    }

    const now = Timestamp.now();
    const userRef = db.collection("users").doc(uid);

    // merge profile
    const payload = {
      language: language ?? admin.firestore.FieldValue.delete(), // اگر نداد، دست نزنیم/پاک نکنیم
      appVersion,
      platform,
      deviceModel,
      lastSeenAt: now,
      // اگر اولین بار است، createdAt را ست کن
      createdAt: now,
      // ساختار اولیه اشتراک اگر وجود ندارد
      subscription: {
        plan: "free",
        type: "free",
        startedAt: now,
        expiresAt: null,
      },
      ...extra,
    };

    await userRef.set(payload, { merge: true });

    // اگر createdAt قبلاً وجود داشته، دست‌نخورده می‌ماند (merge=true)
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("user-ensure error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
