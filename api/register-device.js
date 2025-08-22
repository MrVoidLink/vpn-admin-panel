// api/register-device.js
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

// تولید یک uid تصادفی (بدون Firebase Auth)
function randomUid() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

// اگر uid نیاد، در سرور بساز
async function ensureUid(incomingUid) {
  if (incomingUid && typeof incomingUid === "string" && incomingUid.trim()) return incomingUid;
  for (let i = 0; i < 5; i++) {
    const uid = randomUid();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return uid;
  }
  return randomUid();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const body = await readJsonBody(req);
    let { uid, deviceId, deviceInfo = {} } = body || {};

    // deviceId لازم است
    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    // ساخت uid در بک‌اند در صورت نبود
    uid = await ensureUid(uid);

    const now = Timestamp.now();

    // ---------- User (مثل قبل: اسکلت اولیه فقط بار اول، مرج امن) ----------
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // فقط کلیدهای موجود را مرج می‌کنیم؛ چیزی پاک نمی‌کنیم
    const userData = {
      uid,
      lastSeenAt: now,
      updatedAt: now,
    };

    // از deviceInfo به سطح پروفایل ببریم (اگر واقعاً آمده باشد)
    if (deviceInfo.language != null)   userData.language    = deviceInfo.language;   // زبان ابتدا می‌تواند null بماند و بعداً با setLanguage پر شود
    if (deviceInfo.platform != null)   userData.platform    = deviceInfo.platform;
    if (deviceInfo.model != null)      userData.deviceModel = deviceInfo.model;
    if (deviceInfo.osVersion != null)  userData.osVersion   = deviceInfo.osVersion;
    if (deviceInfo.appVersion != null) userData.appVersion  = deviceInfo.appVersion;

    // فقط اولین‌بار: اسکلت دقیق مثل قبل
    if (!userSnap.exists) {
      Object.assign(userData, {
        createdAt: now,

        // اشتراک/وضعیت (مقادیر اولیه)
        planType: "free",
        status: "guest",
        expiresAt: null,

        // ظرفیت‌ها (برای سازگاری با UIهای مختلف هر دو کلید را داریم)
        maxDevices: null,
        userMaxDevices: null,

        // کد/توکن
        codeId: null,
        currentCode: null,
        tokenId: null,

        // فیلدهای UI/نمایشی
        subscriptionSource: null,
        defaultServer: null,
        notes: null,
        favorites: 0,
        sessions: 0,
        lastServer: null,
        usage: 0, // bytes
      });
    }

    await userRef.set(userData, { merge: true });

    // ---------- Device (بدون تغییر نسبت به قبل) ----------
    const devRef = userRef.collection("devices").doc(deviceId);
    const devSnap = await devRef.get();

    const deviceData = {
      ...deviceInfo,
      isActive: true,
      updatedAt: now,
      ...(devSnap.exists ? {} : { createdAt: now }),
    };

    await devRef.set(deviceData, { merge: true });

    return res.status(200).json({
      ok: true,
      uid,
      profileCreated: !userSnap.exists,
      deviceCreated: !devSnap.exists,
    });
  } catch (e) {
    console.error("register-device error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "INTERNAL" });
  }
}
