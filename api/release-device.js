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
    const codeDevRef = codeRef.collection("devices").doc(deviceId);

    // DocID صحیح برای users/{uid}/devices
    const userDeviceId = deviceId.startsWith(`${uid}_`)
      ? deviceId.slice(uid.length + 1)
      : deviceId;

    const userRef = db.collection("users").doc(uid);
    const userDevRef = userRef.collection("devices").doc(userDeviceId);

    // 1) فقط عملیات اصلی داخل ترنزاکشن
    const txResult = await db.runTransaction(async (tx) => {
      const [codeSnap, devSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const now = admin.firestore.Timestamp.now();

      const maxDevices = Number(code.maxDevices ?? 0);
      const active = Number(code.activeDevices ?? 0);

      const devData = (devSnap.data() || {});
      const wasActive = devSnap.exists && (devData.isActive === true || devData.status === "active");

      if (!wasActive) {
        // idempotent — چیزی برای آزاد کردن نیست
        return {
          activeDevices: Math.max(0, active),
          maxDevices,
          deviceId,
          alreadyReleased: true,
        };
      }

      // آزاد کردن زیر codes/{codeId}/devices
      tx.set(
        codeDevRef,
        { isActive: false, status: "released", releasedAt: now },
        { merge: true }
      );

      // کاهش شمارنده
      const newActive = Math.max(0, active - 1);
      tx.update(codeRef, {
        activeDevices: newActive,
        lastDeviceReleasedAt: now,
        maxDevices,
      });

      // آینه در users/{uid}/devices
      tx.set(
        userDevRef,
        { isActive: false, status: "released", lastSeenAt: now },
        { merge: true }
      );

      return {
        activeDevices: newActive,
        maxDevices,
        deviceId,
        alreadyReleased: false,
      };
    });

    // 2) بیرون از ترنزاکشن: اگر هیچ device فعالی نمانده بود، کاربر را free کن
    // (این کار را هم برای حالت idempotent و هم حالت عادی انجام می‌دهیم)
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
          plan: {
            type: "free",
            status: "free",
            source: "system",
          },
          currentCode: admin.firestore.FieldValue.delete(),
          codeId: admin.firestore.FieldValue.delete(),
          tokenId: admin.firestore.FieldValue.delete(),
          subscription: admin.firestore.FieldValue.delete(),
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
