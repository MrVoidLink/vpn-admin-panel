// api/list-my-devices.js
import { db } from "./firebase-admin.config.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

    const { uid } = req.query || {};
    if (!uid) return res.status(400).json({ error: "uid_required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const user = userSnap.data() || {};
    const codeId = user.tokenId;
    if (!codeId) return res.status(200).json({ ok: true, codeId: null, devices: [] });

    const codeRef = db.collection("codes").doc(codeId);
    const devsSnap = await codeRef.collection("devices").where("uid", "==", uid).get();
    const devices = devsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const codeSnap = await codeRef.get();
    const code = codeSnap.exists ? codeSnap.data() : null;

    return res.status(200).json({
      ok: true,
      codeId,
      maxDevices: code?.maxDevices ?? null,
      activeDevices: code?.activeDevices ?? null,
      devices,
    });
  } catch (e) {
    console.error("list-my-devices error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
