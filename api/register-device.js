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

function randomUid() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

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
    let { uid, deviceId, deviceInfo = {}, profile = {} } = body || {};
    // نکته: profile اختیاریه تا اگر روزی خواستی از اپ چیزی مثل status اولیه بفرستی، merge بشه

    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    uid = await ensureUid(uid);
    const now = Timestamp.now();

    // --- ساخت/به‌روزرسانی پروفایل کاربر ---
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // فیلدهای عمومی که هر بار آپدیت می‌شن
    const baseUserData = {
      uid,
      language: deviceInfo.language ?? FieldValue.delete(),
      platform: deviceInfo.platform ?? FieldValue.delete(),
      deviceModel: deviceInfo.model ?? FieldValue.delete(),
      osVersion: deviceInfo.osVersion ?? FieldValue.delete(),
      appVersion: deviceInfo.appVersion ?? FieldValue.delete(),
      lastSeenAt: now,
      updatedAt: now,
    };

    // اسکلت اولیه فقط بار اول (برای سازگاری با قبل)
    const initialUserSkeleton = userSnap.exists
      ? {}
      : {
          createdAt: now,

          // فیلدهای اشتراک/وضعیت—فقط اسکلت اولیه
          planType: profile.planType ?? null,   // 'premium' | 'gift' | null (کاربر آزاد)
          status: profile.status ?? 'guest',    // 'guest' تا وقتی توکن اعمال نشده
          expiry: profile.expiry ?? null,       // epoch ms یا null
          maxDevices: profile.maxDevices ?? null,
          codeId: profile.codeId ?? null,
          currentCode: profile.currentCode ?? null,

          // اگر از قبل داده‌ای می‌فرستی، اینجا هم merge می‌شود
          ...(typeof profile === 'object' ? profile : {}),
        };

    await userRef.set({ ...baseUserData, ...initialUserSkeleton }, { merge: true });

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
