// /api/server-config.js
// Get a full connection config for a given server id
// Query: id=<serverId>
// Response shape (example):
//  { ok: true, id, protocol: "v2ray", config: { type, uuid, network, host, path, sni, tls, flow } }

import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  allowCORS(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "MISSING_ID" });
  }

  try {
    const doc = await db.collection("servers").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const s = doc.data() || {};

    // سرور غیرفعال را برنگردان
    const status = String(s.status || "active").toLowerCase();
    if (status !== "active") {
      return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });
    }

    const protocol = String(s.protocol || "").toLowerCase();
    if (protocol !== "v2ray" && protocol !== "vmess" && protocol !== "vless") {
      return res.status(400).json({ ok: false, error: "ONLY_V2RAY_SUPPORTED" });
    }

    // ---------- V2RAY ----------
    const cfg = {
      type:    String(s.v2rayType || "").toLowerCase(),        // vless|vmess
      uuid:    String(s.v2rayUuid || ""),
      network: String(s.v2rayNetwork || "").toLowerCase(),      // ws|grpc|tcp
      host:    String(s.v2rayHost || ""),
      path:    String(s.v2rayPath || ""),
      sni:     String(s.v2raySni || ""),
      tls:     !!s.v2rayTls,
    };
    if (String(s.v2rayFlow || "").trim()) cfg.flow = String(s.v2rayFlow).trim();

    // حداقل‌های لازم
    if (!cfg.type || !cfg.uuid || !cfg.network) {
      return res.status(400).json({ ok: false, error: "MISSING_V2RAY_FIELDS" });
    }

    return res.status(200).json({
      ok: true,
      id: doc.id,
      protocol: "v2ray",
      config: cfg,
      meta: {
        host: s.ipAddress || "",
        port: Number(s.port) || null,
        country: s.country || "",
        name: s.serverName || "",
      },
    });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
