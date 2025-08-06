// vite-project/api/file-history.js
import { db } from "./firebase-admin.config.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // گرفتن لیست تاریخچه فایل‌ها
    try {
      const snapshot = await db.collection("files").orderBy("createdAt", "desc").get();
      const files = snapshot.docs.map(doc => doc.data());
      res.status(200).json({ success: true, files });
    } catch (error) {
      res.status(500).json({ success: false, error: "Error fetching files" });
    }
  } else if (req.method === "POST") {
    // ذخیره فایل جدید در Firestore بعد از ساخت اکسل
    try {
      const { name, createdAt, count, validForDays, deviceLimit, type } = req.body;

      // یک id یکتا بساز (مثلاً با نام فایل یا تاریخ)
      const docRef = db.collection("files").doc(name);

      await docRef.set({
        name,
        createdAt,
        count,
        validForDays,
        deviceLimit,
        type,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Error saving file" });
    }
  } else {
    res.status(405).json({ success: false, error: "Method Not Allowed" });
  }
}
