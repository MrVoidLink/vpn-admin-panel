// api/register-device.js
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

// تولید یک uid تصادفی (بدون Firebase Auth)
function randomUid() {
  // دو بخش 16 کاراکتری برای کاهش احتمال برخورد
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

// بررسی و ساخت uid در صورت نبود
async function ensureUid(incomingUid) {
  if (incomingUid && typeof incomingUid === "string" && incomingUid.trim()) return incomingUid;

  // ایجاد uid جدید و چک برخورد سند کاربر (احتمال بسیار کم)
  for (let i = 0; i < 5; i++) {
    const uid = randomUid();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return uid;
  }
  // اگر ۵ بار پشت‌سرهم برخورد داشتیم (خیلی نادر)، آخرین مقدار را برگردان
  return randomUid();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const body = await readJsonBody(req);
    let { uid, deviceId, deviceInfo = {} } = body || {};

    // deviceId لازم است؛ uid اگر نبود اینجا ساخته می‌شود
    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    // اگر uid نیامده باشد، در بک‌اند بساز
    uid = await ensureUid(uid);

    const now = Timestamp.now();

    // --- ساخت/به‌روزرسانی پروفایل کاربر ---
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    const userData = {
      uid,
      // فقط فیلدهایی که از deviceInfo معنا دارند را به پروفایل ببریم (اختیاری)
      language: deviceInfo.language ?? FieldValue.delete(),
      appVersion: deviceInfo.appVersion ?? FieldValue.delete(),
      lastSeenAt: now,
      updatedAt: now,
      ...(userSnap.exists ? {} : { createdAt: now }),
    };
    await userRef.set(userData, { merge: true });

    // --- ثبت/به‌روزرسانی دستگاه ---
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
