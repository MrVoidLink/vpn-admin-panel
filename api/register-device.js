import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";
const { FieldValue, Timestamp } = admin.firestore;

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

    const { uid, deviceId, platform, model, appVersion } = await readJsonBody(req);
    if (!uid || !deviceId || !platform || !model || !appVersion) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const devRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);
    const devSnap = await devRef.get();
    const now = Timestamp.now();

    const base = {
      deviceId,
      platform,
      model,
      appVersion,
      lastSeenAt: now,
    };

    if (devSnap.exists) {
      await devRef.set(base, { merge: true });
    } else {
      await devRef.set({
        ...base,
        isActive: false,
        registeredAt: now,
      }, { merge: true });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("register-device error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}