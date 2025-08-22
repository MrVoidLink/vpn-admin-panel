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

    // --- حالت ست‌کردن زبان (بدون دست‌زدن به سایر فیلدها) ---
    if (action === "setLanguage") {
      const { uid, language } = body || {};
      if (!uid || !language) {
        return res.status(400).json({ error: "uid and language are required" });
      }
      await db.collection("users").doc(uid).set(
        { language, lastSeenAt: now },
        { merge: true }
      );
      return res.status(200).json({ ok: true, mode: "setLanguage" });
    }

    // --- حالت پیش‌فرض: ensure (ورود ناشناس + ساخت/آپدیت پروفایل) ---
    const {
      uid,
      language,   // اختیاری؛ اگر بیاید ست می‌شود
      appVersion,
      platform,
      deviceModel,
      extra = {},
    } = body || {};

    if (!uid || !appVersion || !platform || !deviceModel) {
      return res.status(400).json({ error: "uid, appVersion, platform, deviceModel are required" });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const existing = snap.exists ? (snap.data() || {}) : {};

    // payload پایه (بدون تخریب ساختار موجود)
    const payload = {
      appVersion,
      platform,
      deviceModel,
      lastSeenAt: now,
      ...(language ? { language } : {}), // زبان فقط اگر آمده باشد
      ...extra,
    };

    // createdAt فقط اگر قبلاً نداشته است
    if (!existing.createdAt) {
      payload.createdAt = now;
    }

    // تضمین سازگاری با داشبورد ادمین (aliasها فقط اگر وجود ندارند ست می‌شوند)
    const defaultPlanMap = {
      type: "free",
      source: "app",
      status: "inactive",
      codeId: null,
      maxDevices: null,
      expiresAt: null,
    };

    // مپ plan (قدیمی) فقط اگر وجود ندارد
    if (!existing.plan) {
      payload.plan = defaultPlanMap;
    }

    // aliasهای ریشه فقط اگر وجود ندارند
    if (existing.planType === undefined && existing.plan?.type === undefined) {
      payload.planType = defaultPlanMap.type;
    }
    if (existing.source === undefined && existing.plan?.source === undefined) {
      payload.source = defaultPlanMap.source;
    }
    if (existing.status === undefined && existing.plan?.status === undefined) {
      payload.status = defaultPlanMap.status;
    }
    if (existing.codeId === undefined && existing.plan?.codeId === undefined) {
      payload.codeId = defaultPlanMap.codeId;
    }
    if (existing.maxDevices === undefined && existing.plan?.maxDevices === undefined) {
      payload.maxDevices = defaultPlanMap.maxDevices;
    }
    if (existing.expiresAt === undefined && existing.plan?.expiresAt === undefined) {
      payload.expiresAt = defaultPlanMap.expiresAt;
    }

    // subscription فقط اگر وجود ندارد یا خالی است مقداردهی اولیه می‌شود
    if (!existing.subscription || typeof existing.subscription !== "object") {
      payload.subscription = {
        plan: "free",
        type: "free",
        startedAt: now,
        expiresAt: null,
        ...(extra.subscription || {}),
      };
    }

    await userRef.set(payload, { merge: true });

    return res.status(200).json({ ok: true, mode: "ensure" });
  } catch (e) {
    console.error("user-ensure error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
