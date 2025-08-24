// File: api/servers.js
// Purpose: Read-only endpoint for the app to fetch server list
// Method: GET (and OPTIONS for CORS preflight)
// Query params (optional):
//   - type=free|premium
//   - protocol=wireguard|openvpn
//   - limit=number (default 100, max 500)
//
// Response:
//   200: { ok: true, servers: [ { id, name, country, host, port, protocol, type } ] }
//   4xx/5xx: { ok: false, error: "..." }

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

  try {
    const { type, protocol } = req.query;

    // safe limit
    let limit = parseInt(req.query.limit || "100", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;
    if (limit > 500) limit = 500;

    let q = db.collection("servers");

    // optional filters (make sure your stored values are lowercase)
    if (type) q = q.where("serverType", "==", String(type).toLowerCase());
    if (protocol) q = q.where("protocol", "==", String(protocol).toLowerCase());

    // order by createdAt if available (ignore if field/index missing)
    try {
      q = q.orderBy("createdAt", "desc");
    } catch (_) {
      // If no field/index, continue without ordering
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
        protocol: (m.protocol || "").toLowerCase(),      // "wireguard" | "openvpn"
        type: (m.serverType || m.type || "").toLowerCase(), // "free" | "premium"
      };
    });

    return res.status(200).json({ ok: true, servers });
  } catch (e) {
    console.error("GET /api/servers failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
