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

// بررسی و ساخت uid در صورت نبود
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
    // می‌تونیم از کلاینت علاوه بر deviceInfo یک آبجکت profile هم بگیریم (اختیاری)
    let { uid, deviceId, deviceInfo = {}, profile = {} } = body || {};

    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    uid = await ensureUid(uid);
    const now = Timestamp.now();

    // ---------- User profile (merge-safe) ----------
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // فقط کلیدهای موجود را مرج کن تا مقدارهای قبلی از بین نروند
    const userData = {
      uid,
      lastSeenAt: now,
      updatedAt: now,
    };

    // deviceInfo → سطح پروفایل
    if (deviceInfo.language != null)   userData.language    = deviceInfo.language;
    if (deviceInfo.platform != null)   userData.platform    = deviceInfo.platform;
    if (deviceInfo.model != null)      userData.deviceModel = deviceInfo.model;
    if (deviceInfo.osVersion != null)  userData.osVersion   = deviceInfo.osVersion;
    if (deviceInfo.appVersion != null) userData.appVersion  = deviceInfo.appVersion;

    // profile → مرج اختیاری
    if (profile && typeof profile === "object") {
      for (const [k, v] of Object.entries(profile)) {
        if (v !== undefined) userData[k] = v;
      }
    }

    // فقط بار اول: اسکلت سازگار با Admin Panel/کلاینت
    if (!userSnap.exists) {
      userData.createdAt = now;

      // اشتراک/وضعیت
      if (userData.planType === undefined)      userData.planType = "free";
      if (userData.status === undefined)        userData.status   = "guest";
      if (userData.expiresAt === undefined)     userData.expiresAt = null;

      // ظرفیت دستگاه‌ها: برای سازگاری هر دو را نگه داریم
      if (userData.maxDevices === undefined)        userData.maxDevices = null;
      if (userData.userMaxDevices === undefined)    userData.userMaxDevices = userData.maxDevices;

      // کد/توکن
      if (userData.codeId === undefined)        userData.codeId = null;
      if (userData.currentCode === undefined)   userData.currentCode = null;
      if (userData.tokenId === undefined)       userData.tokenId = null; // اگر UI شما Token ID نشان می‌دهد

      // فیلدهای UI (خنثی/نمایشی)
      if (userData.subscriptionSource === undefined) userData.subscriptionSource = null;
      if (userData.defaultServer === undefined)      userData.defaultServer = null;
      if (userData.notes === undefined)              userData.notes = null;
      if (userData.favorites === undefined)          userData.favorites = 0;
      if (userData.sessions === undefined)           userData.sessions = 0;
      if (userData.lastServer === undefined)         userData.lastServer = null;
      if (userData.usage === undefined)              userData.usage = 0; // bytes
    }

    await userRef.set(userData, { merge: true });

    // ---------- Device (same logic) ----------
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
