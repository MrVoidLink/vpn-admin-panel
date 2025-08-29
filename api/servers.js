// /api/servers.js
import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  allowCORS(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const typeRaw  = Array.isArray(req.query.type)  ? req.query.type[0]  : req.query.type;

    let limit = parseInt(limitRaw ?? "100", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;

    const type = String(typeRaw || "").trim().toLowerCase(); // free | premium | ""

    let q = db.collection("servers")
      .where("status", "==", "active")
      .where("protocol", "==", "openvpn");

    if (type) q = q.where("serverType", "==", type);

    const snap = await q.limit(limit).get();

    const servers = snap.docs.map((d) => {
      const v = d.data() || {};
      return {
        id: d.id,
        name: v.serverName ?? "",
        host: v.ipAddress ?? v.host ?? "",
        port: v.port ?? null,
        country: v.country ?? "",
        city: v.location ?? "",
        type: v.serverType ?? null,      // free | premium
        protocol: "openvpn",
        pingMs: v.pingMs ?? null,
        load: v.load ?? null,
      };
    });

    return res.status(200).json({ ok: true, servers });
  } catch (e) {
    console.error("GET /api/servers error:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
