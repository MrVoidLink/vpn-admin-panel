// vite-project/api/generate-code.js
import { db } from "./firebase-admin.config.js";
import { Timestamp } from "firebase-admin/firestore";

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default async function handler(req, res) {
  try {
    const {
      count = 10,
      validForDays = 30,   // v2
      maxDevices = 1,      // v2
      type = "premium",
      source = "admin",
    } = req.query;

    const n = Number(count);
    const days = Number(validForDays);
    const max  = Number(maxDevices);

    const allowedDurations = [15, 30, 60, 90, 180, 365];
    const allowedTypes = ["premium", "gift"];

    if (!Number.isFinite(n) || n < 1 || n > 5000)
      return res.status(400).json({ success: false, error: "Invalid count (1..5000)" });
    if (!allowedDurations.includes(days))
      return res.status(400).json({ success: false, error: "Invalid validForDays" });
    if (!allowedTypes.includes(type))
      return res.status(400).json({ success: false, error: "Invalid code type" });
    if (!Number.isFinite(max) || max < 1 || max > 10)
      return res.status(400).json({ success: false, error: "Invalid maxDevices (1..10)" });

    const codes = [];
    for (let i = 0; i < n; i++) {
      const code = randomCode(8);
      const codeData = {
        code,
        type,
        validForDays: days,
        maxDevices: max,
        activeDevices: 0,
        source,
        createdAt: Timestamp.now(),
        activatedAt: null,
        expiresAt: null,
        lastDeviceClaimedAt: null,
        lastDeviceReleasedAt: null,
      };
      
      await db.collection("codes").doc(code).set(codeData);
      codes.push(codeData);
    }

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      generated: codes.length,
      codes,
    });
  } catch (error) {
    console.error("❌ generate-code error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
