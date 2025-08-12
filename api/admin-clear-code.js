// api/admin-clear-code.js
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
    const { codeId } = body || {};
    if (!codeId) return res.status(400).json({ error: "codeId is required" });

    const codeRef = db.collection("codes").doc(codeId);
    const snap = await codeRef.get();
    if (!snap.exists) return res.status(404).json({ error: "CODE_NOT_FOUND" });

    const devsRef = codeRef.collection("devices");
    const devsSnap = await devsRef.get();

    const now = admin.firestore.Timestamp.now();
    let cleared = 0;
    const CHUNK = 400;

    const docs = devsSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const batch = db.batch();
      slice.forEach((d) => {
        const data = d.data() || {};

        // زیر codes/{codeId}/devices
        batch.set(devsRef.doc(d.id), { isActive: false, active: false, releasedAt: now }, { merge: true });

        // آینه زیر users/{uid}/devices
        if (data.uid) {
          const userDevRef = db.collection("users").doc(data.uid).collection("devices").doc(d.id);
          batch.set(userDevRef, { isActive: false, active: false, lastSeenAt: now }, { merge: true });
        }
      });
      await batch.commit();
      cleared += slice.length;
    }

    await codeRef.update({
      activeDevices: 0,
      isUsed: false,
      lastDeviceReleasedAt: now,
    });

    return res.status(200).json({ ok: true, clearedDevices: cleared });
  } catch (e) {
    console.error("admin-clear-code error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
