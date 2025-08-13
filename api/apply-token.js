// api/apply-token.js
import { db } from "./firebase-admin.config.js";
import { Timestamp } from "firebase-admin/firestore";
import admin from "firebase-admin";

// بدنه‌ی درخواست را مطمئن بخوان (vercel dev / vite proxy)
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

    const { uid, codeId, deviceId, deviceInfo = {} } = await readJsonBody(req);
    if (!uid || !codeId) return res.status(400).json({ error: "uid_and_code_required" });

    const codeRef = db.collection("codes").doc(codeId);
    const userRef = db.collection("users").doc(uid);

    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) return res.status(404).json({ error: "CODE_NOT_FOUND" });

    const code = codeSnap.data() || {};
    const validForDays = Number(code.validForDays ?? 0);
    const maxDevices  = Number(code.maxDevices ?? 0);
    const type        = code.type || "premium";
    if (!validForDays || !maxDevices) return res.status(400).json({ error: "INVALID_CODE_META" });

    const now = Timestamp.now();
    const activatedAt = code.activatedAt ?? now;
    const expiresAt =
      code.expiresAt ?? Timestamp.fromMillis(activatedAt.toMillis() + validForDays * 86400000);

    if (expiresAt.toMillis() <= Date.now()) {
      return res.status(400).json({ error: "CODE_EXPIRED" });
    }

    // حالت ۱: فقط Apply (وقتی deviceId نداریم)
    if (!deviceId) {
      await db.runTransaction(async (tx) => {
        tx.set(codeRef, { type, validForDays, maxDevices, activatedAt, expiresAt }, { merge: true });
        tx.set(
          userRef,
          {
            tokenId: codeId,
            planType: type === "gift" ? "gift" : "premium",
            status: "active",
            subscription: { source: code.source || "admin", codeId, expiresAt },
          },
          { merge: true }
        );
        tx.set(codeRef.collection("redemptions").doc(uid), { uid, action: "apply", appliedAt: now });
      });

      return res.status(200).json({
        ok: true,
        mode: "APPLY_ONLY",
        codeId,
        validForDays,
        maxDevices,
        activatedAt: activatedAt.toDate(),
        expiresAt: expiresAt.toDate(),
      });
    }

    // حالت ۲: Apply + Auto‑Claim (وقتی deviceId داریم)
    const codeDevRef = codeRef.collection("devices").doc(deviceId);
    const userDevRef = userRef.collection("devices").doc(deviceId);

    const result = await db.runTransaction(async (tx) => {
      const freshCodeSnap = await tx.get(codeRef);
      if (!freshCodeSnap.exists) throw new Error("CODE_NOT_FOUND");
      const freshCode = freshCodeSnap.data() || {};
      const active = Number(freshCode.activeDevices ?? 0);

      // همیشه Apply را تثبیت کن
      tx.set(codeRef, { type, validForDays, maxDevices, activatedAt, expiresAt }, { merge: true });
      tx.set(
        userRef,
        {
          tokenId: codeId,
          planType: type === "gift" ? "gift" : "premium",
          status: "active",
          subscription: { source: freshCode.source || "admin", codeId, expiresAt },
        },
        { merge: true }
      );
      tx.set(codeRef.collection("redemptions").doc(uid), { uid, action: "apply", appliedAt: now });

      // ظرفیت پر؟
      if (active >= maxDevices) {
        return { mode: "APPLY_ONLY_CAPACITY_FULL", activeDevices: active, maxDevices, alreadyActive: false };
      }

      // اگر این device قبلاً active بوده
      const codeDevSnap = await tx.get(codeDevRef);
      const wasActive = codeDevSnap.exists && !!(codeDevSnap.data() || {}).isActive;
      if (wasActive) {
        return { mode: "APPLY_AND_ALREADY_ACTIVE", activeDevices: active, maxDevices, alreadyActive: true };
      }

      // Claim دستگاه
      const nowAdmin = admin.firestore.Timestamp.now();
      tx.set(
        codeDevRef,
        {
          uid,
          isActive: true,
          claimedAt: nowAdmin,
          platform: deviceInfo.platform || null,
          model: deviceInfo.model || null,
          appVersion: deviceInfo.appVersion || null,
        },
        { merge: true }
      );
      tx.set(
        userDevRef,
        {
          deviceId,
          uid,
          isActive: true,
          platform: deviceInfo.platform || null,
          model: deviceInfo.model || null,
          appVersion: deviceInfo.appVersion || null,
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSeenAt: nowAdmin,
        },
        { merge: true }
      );
      tx.set(
        codeRef,
        { activeDevices: active + 1, lastDeviceClaimedAt: nowAdmin, activatedAt, expiresAt },
        { merge: true }
      );

      return { mode: "APPLY_AND_CLAIMED", activeDevices: active + 1, maxDevices, alreadyActive: false };
    });

    return res.status(200).json({
      ok: true,
      codeId,
      validForDays,
      maxDevices,
      activatedAt: activatedAt.toDate(),
      expiresAt: expiresAt.toDate(),
      ...result,
    });
  } catch (e) {
    console.error("apply-token error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
