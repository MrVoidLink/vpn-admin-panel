// vite-project/api/generate-code.js
import { db } from "./firebase-admin.config.js";
import { Timestamp } from "firebase-admin/firestore";

export default async function handler(req, res) {
  try {
    const {
      count = 10,
      duration = 30,
      deviceLimit = 1,
      type = "premium",
      source = "admin", // منبع تولید کد
    } = req.query;

    console.log("🧩 API Called with:", { count, duration, deviceLimit, type, source });

    const allowedDurations = [15, 30, 60, 90, 180, 365];
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
        code,                          // کد قابل نمایش
        type,                          // premium یا gift
        validForDays: Number(duration),// مدت اعتبار (روز)
        remainingDevices: Number(deviceLimit), // چند دستگاه می‌تواند فعال کند
        isUsed: false,                 // هنوز استفاده نشده
        source,                        // منبع تولید کد
        createdAt: Timestamp.now(),
        activatedAt: null,             // برای تاریخ فعال‌سازی اگر لازم شد
      };

      // ذخیره با شناسه برابر با کد (doc.id = code)
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
