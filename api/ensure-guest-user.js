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

    const { uid, appVersion, platform, deviceModel } = await readJsonBody(req);
    if (!uid || !appVersion || !platform || !deviceModel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const now = Timestamp.now();

    const base = {
      appVersion,
      platform,
      deviceModel,
      lastSeenAt: now,
      status: "active",
    };

    if (userSnap.exists) {
      await userRef.set(base, { merge: true });
    } else {
      await userRef.set({
        ...base,
        createdAt: now,
        plan: {
          type: "free",
          source: "app",
          status: "inactive",
        },
        planType: "free",
        source: "app",
        codeId: null,
        tokenId: null,
        subscription: {
          codeId: null,
          source: "app",
          expiresAt: null,
        },
      }, { merge: true });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ensure-guest-user error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}