
import { db } from "./firebase-admin.config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { method, path, data, options } = req.body || {};

    if (!method || !path) {
      return res.status(400).json({ error: "Missing method or path" });
    }

    const ref = db.doc(path.includes("/") ? path : `__invalid__/${path}`);

    let result;
    switch (method.toLowerCase()) {
      case "get":
        result = await ref.get();
        if (!result.exists) {
          return res.status(404).json({ error: "Document not found" });
        }
        return res.status(200).json(result.data());
      case "set":
        await ref.set(data || {}, options || { merge: true });
        return res.status(200).json({ ok: true });
      case "update":
        await ref.update(data || {});
        return res.status(200).json({ ok: true });
      case "delete":
        await ref.delete();
        return res.status(200).json({ ok: true });
      default:
        return res.status(400).json({ error: "Invalid method" });
    }
  } catch (err) {
    console.error("firestore-proxy error:", err);
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
