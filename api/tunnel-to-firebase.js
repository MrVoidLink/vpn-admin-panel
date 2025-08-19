// api/tunnel-to-firebase.js
import { db } from "./firebase-admin.config.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = req.body;
    const { fields } = body || {};

    if (!fields || typeof fields !== "object") {
      return res.status(400).json({ error: "Missing fields in body" });
    }

    // ساخت سند جدید در کالکشن "codes"
    const result = await db.collection("codes").add(fields);

    return res.status(200).json({
      ok: true,
      documentId: result.id,
    });
  } catch (err) {
    console.error("tunnel-to-firebase error:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
}
