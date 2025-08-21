// api/register-device.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";
const { Timestamp } = admin.firestore;

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

    const body = await readJsonBody(req);
    const {
      uid,
      deviceId,
      deviceInfo = {},   // { model, brand, osVersion, appVersion, platform, ... }
    } = body || {};

    if (!uid || !deviceId) {
      return res.status(400).json({ error: "uid and deviceId are required" });
    }

    const now = Timestamp.now();
    const devRef = db.collection("users").doc(uid).collection("devices").doc(deviceId);

    await devRef.set(
      {
        ...deviceInfo,
        isActive: true,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("register-device error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}
