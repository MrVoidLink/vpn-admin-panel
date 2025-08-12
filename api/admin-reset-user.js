// api/admin-reset-user.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // بدنهٔ درخواست
    let body = req.body;
    if (!body) {
      try { body = await req.json?.(); } catch (_) {}
    }
    const { uid, alsoRemoveRedemption = true } = body || {};
    if (!uid) return res.status(400).json({ error: "uid is required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const user = userSnap.data() || {};
    const codeId = user.tokenId;

    // کاربر کد ندارد → فقط ریست پروفایل و غیرفعال‌کردن دیوایس‌ها
    if (!codeId) {
      await userRef.update({
        planType: "free",
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
        status: "active",
      });
      const now = admin.firestore.Timestamp.now();
      const udevs = await userRef.collection("devices").get();
      await Promise.all(
        udevs.docs.map((d) =>
          userRef.collection("devices").doc(d.id).set(
            { isActive: false, active: false, lastSeenAt: now },
            { merge: true }
          )
        )
      );
      return res.status(200).json({ ok: true, clearedDevices: 0 });
    }

    const codeRef = db.collection("codes").doc(codeId);
    const devsRef = codeRef.collection("devices");

    // دستگاه‌های فعال این کاربر برای همین کد
    const activeByUserSnap = await devsRef
      .where("uid", "==", uid)
      .where("isActive", "==", true)
      .get();
    const activeCount = activeByUserSnap.size;

    const userDevsSnap = await userRef.collection("devices").get();

    await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

      const code = codeSnap.data() || {};
      const active = Number(code.activeDevices ?? 0);
      const max = Number(code.maxDevices ?? code.deviceLimit ?? 0);
      const now = admin.firestore.Timestamp.now();

      // آزاد کردن دیوایس‌های کاربر
      activeByUserSnap.docs.forEach((docSnap) => {
        tx.set(devsRef.doc(docSnap.id), { isActive: false, active: false, releasedAt: now }, { merge: true });
      });

      const newActive = Math.max(0, active - activeCount);
      tx.update(codeRef, {
        activeDevices: newActive,
        isUsed: newActive >= max,
        lastDeviceReleasedAt: now,
      });

      // ریست پروفایل کاربر
      tx.update(userRef, {
        planType: "free",
        subscription: admin.firestore.FieldValue.delete(),
        tokenId: admin.firestore.FieldValue.delete(),
        status: "active",
      });

      // آینهٔ devices زیر users/{uid}
      userDevsSnap.docs.forEach((ud) => {
        tx.set(
          userRef.collection("devices").doc(ud.id),
          { isActive: false, active: false, lastSeenAt: now },
          { merge: true }
        );
      });

      // حذف redemption (اختیاری برای تست مجدد)
      if (alsoRemoveRedemption) {
        tx.delete(codeRef.collection("redemptions").doc(uid));
      }
    });

    return res.status(200).json({ ok: true, clearedDevices: activeCount, codeId });
  } catch (e) {
    console.error("admin-reset-user error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
