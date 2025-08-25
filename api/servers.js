// File: api/servers.js
// Read-only endpoint for the app to fetch server list (ONLY V2 family)
export const runtime = 'nodejs';

import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  allowCORS(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  try {
    const { type } = req.query;

    let limit = parseInt(req.query.limit || "100", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;
    if (limit > 500) limit = 500;

    // فقط V2 (مثل قبل) + فقط active
    let q = db
      .collection("servers")
      .where("protocol", "in", ["v2ray", "vmess", "vless"])
      .where("status", "==", "active");

    if (type) q = q.where("serverType", "==", String(type).toLowerCase());

    try {
      q = q.orderBy("createdAt", "desc");
    } catch (_) {
      // بدون ایندکس/فیلد هم ادامه می‌دیم
    }

    const snap = await q.limit(limit).get();

    const servers = snap.docs.map((d) => {
      const m = d.data() || {};
      return {
        id: d.id,
        name: m.serverName || m.name || "",
        country: m.country || m.countryCode || "",
        host: m.ipAddress || m.host || "",
        port: Number(m.port) || null,
        protocol: (m.protocol || "").toLowerCase(),           // v2ray|vmess|vless
        type: (m.serverType || m.type || "").toLowerCase(),   // free|premium
        status: (m.status || "active").toLowerCase(),
        pingMs: Number.isFinite(m.pingMs) ? Number(m.pingMs) : null,
      };
    });

    return res.status(200).json({ ok: true, servers });
  } catch (e) {
    console.error("GET /api/servers failed:", e);
    if (process.env.DEBUG === "1") {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
