// api/generate-code.js
import { db } from "../firebase-admin.config"; // این فایل رو باید بسازی
import { Timestamp } from "firebase-admin/firestore";

export default async function handler(req, res) {
  try {
    const {
      count = 10,
      duration = 30,
      deviceLimit = 1,
      type = "premium",
    } = req.query;

    console.log("🧩 API Called with:", { count, duration, deviceLimit, type });

    const allowedDurations = [15, 30, 60, 90, 180, 365]; // ✅ اضافه شد
    const allowedTypes = ["premium", "gift"];

    if (!allowedDurations.includes(Number(duration))) {
      return res.status(400).json({ success: false, error: "Invalid duration" });
    }

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid code type" });
    }

    const codes = [];

    for (let i = 0; i < parseInt(count); i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();

      const codeData = {
        code,
        duration: Number(duration),
        deviceLimit: Number(deviceLimit),
        type,
        createdAt: Timestamp.now(),
        isUsed: false,
        activatedAt: null,
      };

      // ذخیره در Firestore
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
    console.error("❌ API Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
