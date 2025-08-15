// api/release-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    let body = req.body;
    if (!body) { try { body = await req.json?.(); } catch (_) {} }
    const { uid, codeId, deviceId } = body || {};
    if (!uid || !codeId || !deviceId)
      return res.status(400).json({ error: "uid, codeId, deviceId are required" });

    const codeRef = db.collection("codes").doc(codeId);
    const devsCol = codeRef.collection("devices");

    // --- تلاش برای پیدا کردن DocID صحیح (هر سه الگوی رایج)
    const candidateIds = [deviceId, `${uid}_${deviceId}`, uid];

    // سعی اول: با doc-id مستقیم
    const found = [];
    for (const cid of candidateIds) {
      const ref = devsCol.doc(cid);
      const snap = await ref.get();
      if (snap.exists) {
        found.push({ id: cid, ref, snap });
        break;
      }
    }

    // fallback: جستجو بر اساس فیلدها
    if (found.length === 0) {
      const byDevId = await devsCol.where("deviceId", "==", deviceId).limit(1).get();
      if (!byDevId.empty) {
        const d = byDevId.docs[0];
        found.push({ id: d.id, ref: devsCol.doc(d.id), snap: d });
      } else {
        const byUid = await devsCol.where("uid", "==", uid).limit(5).get();
        if (!byUid.empty) {
          // اگر `${uid}_${deviceId}` وجود داشت، همان را انتخاب کن؛ وگرنه اولین
          const exact = byUid.docs.find(d => d.id === `${uid}_${deviceId}`) || byUid.docs[0];
          found.push({ id: exact.id, ref: devsCol.doc(exact.id), snap: exact });
        }
      }
    }

    // اگر چیزی پیدا نشد، همچنان کاربر را آزاد کن و 200 بده (idempotent)
    if (found.length === 0) {
      const userRef = db.collection("users").doc(uid);
      const plainDevId = deviceId;
      const userDevRef = userRef.collection("devices").doc(plainDevId);

      await db.runTransaction(async (tx) => {
        tx.set(userDevRef, { isActive: false, status: "released", lastSeenAt: admin.firestore.Timestamp.now() }, { merge: true });
      });

      return res.status(200).json({ ok: true, deviceId, alreadyReleased: true, userDowngraded: await _maybeDowngrade(uid) });
    }

    // --- ترنزاکشن: آزاد کردن سند پیدا شده + کم کردن شمارنده + آینه‌ی user/devices
    const chosen = found[0];
    const userRef = db.collection("users").doc(uid);

    const txResult = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const now = admin.firestore.Timestamp.now();
      const code = codeSnap.data() || {};
      const active = Number(code.activeDevices ?? 0);
      const maxDevices = Number(code.maxDevices ?? 0);

      // وضعیت فعلی
      const devData = (chosen.snap.data() || {});
      const status = String(devData.status || "");
      const consideredActive = (status === "active" || status === "") && (devData.isActive !== false);

      // غیرفعال کردن روی کالکشن کُد
      tx.set(chosen.ref, { isActive: false, status: "released", releasedAt: now }, { merge: true });

      if (consideredActive) {
        tx.set(codeRef, {
          activeDevices: admin.firestore.FieldValue.increment(-1),
          lastDeviceReleasedAt: now,
          maxDevices,
        }, { merge: true });
      }

      // users/{uid}/devices/{plainDeviceId}
      const plainDeviceId = deviceId; // برای یکنواختی با اپ
      const userDevRef = userRef.collection("devices").doc(plainDeviceId);
      tx.set(userDevRef, {
        isActive: false,
        status: "released",
        lastSeenAt: now,
        releasedAt: now,
      }, { merge: true });

      return {
        ok: true,
        deviceDocId: chosen.id,
        wasActiveOnCode: consideredActive,
      };
    });

    // اگر دیگر device فعالی نمانده، کاربر را free کن
    const userDowngraded = await _maybeDowngrade(uid);

    return res.status(200).json({ ...txResult, userDowngraded });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}

async function _maybeDowngrade(uid) {
  const userRef = db.collection("users").doc(uid);
  const activeLeftSnap = await userRef.collection("devices").where("isActive", "==", true).limit(1).get();
  if (!activeLeftSnap.empty) return false;

  await userRef.set(
    {
      planType: "free",
      status: "free",
      source: "system",
      plan: { type: "free", status: "free", source: "system" },
      currentCode: admin.firestore.FieldValue.delete(),
      codeId: admin.firestore.FieldValue.delete(),
      tokenId: admin.firestore.FieldValue.delete(),
      subscription: admin.firestore.FieldValue.delete(),
      expiresAt: admin.firestore.FieldValue.delete(),
      maxDevices: admin.firestore.FieldValue.delete(),
      validForDays: admin.firestore.FieldValue.delete(),
      lastSeenAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
  return true;
}
