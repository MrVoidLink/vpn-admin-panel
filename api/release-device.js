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

    // 🔧 DocID صحیح برای users/{uid}/devices:
    // اگر deviceId به‌صورت `${uid}_${deviceId}` آمد، بخش بعد از `${uid}_` را بردار.
    const userDeviceId = deviceId.startsWith(`${uid}_`)
      ? deviceId.slice(uid.length + 1)
      : deviceId;

    const userRef = db.collection("users").doc(uid);
    const userDevRef = userRef.collection("devices").doc(userDeviceId);

    const result = await db.runTransaction(async (tx) => {
      const [codeSnap, devSnap] = await Promise.all([tx.get(codeRef), tx.get(codeDevRef)]);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const now = admin.firestore.Timestamp.now();

      const maxDevices = Number(code.maxDevices ?? 0);
      const active = Number(code.activeDevices ?? 0);

      const devData = (devSnap.data() || {});
      // هر دو مدل ذخیره‌سازی را پشتیبانی کن
      const wasActive = devSnap.exists && (devData.isActive === true || devData.status === "active");

      // idempotent
      if (!wasActive) {
        // حتی اگر دستگاه فعال نبود، باز هم وضعیت کاربر را بررسی می‌کنیم
        // تا اگر هیچ دستگاه فعالی ندارد، او را به free برگردانیم.
        // (این چک را خارج از ترنزاکشن انجام می‌دهیم بعد از return اصلی.)
        return {
          activeDevices: Math.max(0, active),
          maxDevices,
          deviceId,
          alreadyReleased: true,
          isUsed: Math.max(0, active) >= maxDevices,
          _shouldCheckUserFree: true, // پرچم برای چک بعد از ترنزاکشن
        };
      }

      // آزاد کردن زیر codes/{codeId}/devices
      tx.set(
        codeDevRef,
        { isActive: false, status: "released", releasedAt: now },
        { merge: true }
      );

      // کاهش شمارنده و ثبت تاریخ
      const newActive = Math.max(0, active - 1);
      tx.update(codeRef, {
        activeDevices: newActive,
        lastDeviceReleasedAt: now,
        maxDevices,
      });

      // آینه در users/{uid}/devices — با DocID صحیح
      tx.set(
        userDevRef,
        { isActive: false, status: "released", lastSeenAt: now },
        { merge: true }
      );

      // ✅ داخل همین ترنزاکشن، چک کنیم آیا کاربر دستگاه فعال دیگری دارد یا نه
      const activeQuery = userRef.collection("devices")
        .where("isActive", "==", true)
        .limit(1);

      const activeSnap = await tx.get(activeQuery);

      let userDowngraded = false;
      if (activeSnap.empty) {
        // هیچ دستگاه فعالی باقی نمانده → کاربر را Free کن
        tx.set(userRef, {
          planType: "free",
          status: "free",
          source: "system",
          // پلان حداقلی
          plan: {
            type: "free",
            status: "free",
            source: "system",
          },
          // این‌ها را پاک می‌کنیم تا اپ بفهمد اشتراک فعال ندارد
          currentCode: admin.firestore.FieldValue.delete(),
          codeId: admin.firestore.FieldValue.delete(),
          tokenId: admin.firestore.FieldValue.delete(),
          subscription: admin.firestore.FieldValue.delete(),
          lastSeenAt: now,
        }, { merge: true });
        userDowngraded = true;
      }

      return {
        activeDevices: newActive,
        maxDevices,
        deviceId,
        alreadyReleased: false,
        isUsed: newActive >= maxDevices,
        userDowngraded,
      };
    });

    // اگر در حالت idempotent بودیم (alreadyReleased) هم لازم است
    // بیرون از ترنزاکشن یک‌بار وضعیت دستگاه‌های فعالِ کاربر را چک کنیم.
    if (result?._shouldCheckUserFree) {
      const activeLeft = await db
        .collection("users").doc(uid)
        .collection("devices")
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (activeLeft.empty) {
        await db.collection("users").doc(uid).set({
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
        }, { merge: true });
        result.userDowngraded = true;
      }
      delete result._shouldCheckUserFree;
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("release-device error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
}
