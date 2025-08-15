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

    // ---------- پیدا کردن DocID صحیح زیر codes/{codeId}/devices ----------
    let finalDeviceDocId = deviceId; // ابتدا همینی که آمده
    const tryIds = [deviceId, `${uid}_${deviceId}`];

    // سعی کن سریع با get پیدا کنی
    let codeDevRef = codeRef.collection("devices").doc(tryIds[0]);
    let devSnap = await codeDevRef.get();

    if (!devSnap.exists) {
      codeDevRef = codeRef.collection("devices").doc(tryIds[1]);
      devSnap = await codeDevRef.get();
      if (devSnap.exists) finalDeviceDocId = tryIds[1];
    }

    // اگر باز هم پیدا نشد، یک fallback-query (برای سازگاری با نسخه‌های خیلی قدیمی)
    if (!devSnap.exists) {
      const byDeviceId = await codeRef.collection("devices").where("deviceId", "==", deviceId).limit(1).get();
      if (!byDeviceId.empty) {
        finalDeviceDocId = byDeviceId.docs[0].id;
        codeDevRef = codeRef.collection("devices").doc(finalDeviceDocId);
        devSnap = byDeviceId.docs[0];
      } else {
        const byUid = await codeRef.collection("devices").where("uid", "==", uid).limit(5).get();
        if (!byUid.empty) {
          // اگر چندتا بود، نزدیک‌ترین به الگوی `${uid}_${deviceId}` را انتخاب کن
          const candidate = byUid.docs.find(d => d.id === `${uid}_${deviceId}`) || byUid.docs[0];
          finalDeviceDocId = candidate.id;
          codeDevRef = codeRef.collection("devices").doc(finalDeviceDocId);
          devSnap = candidate;
        }
      }
    }
    // ---------------------------------------------------------------

    // DocID صحیح برای users/{uid}/devices
    const userDeviceId = finalDeviceDocId.startsWith(`${uid}_`)
      ? finalDeviceDocId.slice(uid.length + 1)
      : deviceId;

    const userRef = db.collection("users").doc(uid);
    const userDevRef = userRef.collection("devices").doc(userDeviceId);

    // 1) عملیات اصلی داخل ترنزاکشن
    const txResult = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const now = admin.firestore.Timestamp.now();

      const maxDevices = Number(code.maxDevices ?? 0);
      const active = Number(code.activeDevices ?? 0);

      let wasActive = false;
      if (devSnap && devSnap.exists) {
        const devData = devSnap.data() || {};
        const status = String(devData.status || "");
        const isActive = devData.isActive === true || devData.isActive === undefined;
        wasActive = (status === "active" || status === "") && isActive;

        // ⬇️ غیرفعال کن (یا می‌تونی delete کنی)
        tx.set(
          codeDevRef,
          { isActive: false, status: "released", releasedAt: now },
          { merge: true }
        );

        if (wasActive) {
          tx.set(codeRef, {
            activeDevices: admin.firestore.FieldValue.increment(-1),
            lastDeviceReleasedAt: now,
            maxDevices,
          }, { merge: true });
        }
      }

      // آینه در users/{uid}/devices/{userDeviceId}
      tx.set(
        userDevRef,
        { isActive: false, status: "released", lastSeenAt: now },
        { merge: true }
      );

      return {
        deviceId: finalDeviceDocId,
        alreadyReleased: !wasActive,
        maxDevices,
      };
    });

    // 2) بیرون از ترنزاکشن: اگر دیگر هیچ دستگاه فعالی نمانده، کاربر free شود
    const activeLeftSnap = await userRef
      .collection("devices")
      .where("isActive", "==", true)
      .limit(1)
      .get();

    let userDowngraded = false;
    if (activeLeftSnap.empty) {
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
      userDowngraded = true;
    }

    return res.status(200).json({ ok: true, ...txResult, userDowngraded });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
