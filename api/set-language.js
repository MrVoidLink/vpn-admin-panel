import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";
const { FieldValue } = admin.firestore;

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

    const { uid, language } = await readJsonBody(req);
    if (!uid || !language) return res.status(400).json({ error: "Missing uid or language" });

    const userRef = db.collection("users").doc(uid);

    await userRef.set({
      language: language.trim(),
      lastSeenAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("set-language error:", e);
    return res.status(500).json({ error: e?.message || "INTERNAL" });
  }
}