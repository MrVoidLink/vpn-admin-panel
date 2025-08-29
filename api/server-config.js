// /api/server-config.js
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
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "MISSING_ID" });

  try {
    // 1) Load server
    const doc = await db.collection("servers").doc(id).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const s = doc.data() || {};

    // Only active
    const status = String(s.status || "active").toLowerCase();
    if (status !== "active") {
      return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });
    }

    // OpenVPN only
    const protocol = String(s.protocol || "openvpn").toLowerCase();
    if (protocol !== "openvpn") {
      return res.status(400).json({ ok: false, error: "ONLY_OPENVPN_SUPPORTED" });
    }

    // 2) Load per-server config (if exists)
    const cfgDoc = await db.collection("serverConfigs").doc(id).get();
    const cfgData = cfgDoc.exists ? (cfgDoc.data() || {}) : {};

    const ipAddress = String(s.ipAddress || s.host || "").trim();
    const port = Number(s.port || cfgData?.meta?.port || 1194);

    const configFileUrl = String(cfgData.configFileUrl || s.configFileUrl || "").trim();
    const username = String(cfgData.username || s.ovpnUsername || "").trim();
    const password = String(cfgData.password || s.ovpnPassword || "").trim();

    if (!ipAddress) {
      return res.status(400).json({ ok: false, error: "MISSING_CONNECT_HOST" });
    }

    const cfg = {
      protocol: "openvpn",
      ...(configFileUrl ? { configFileUrl } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      meta: { host: ipAddress, port },
    };

    return res.status(200).json({
      ok: true,
      id: doc.id,
      protocol: "openvpn",
      config: cfg,
      meta: {
        name: s.serverName || "",
        country: s.country || "",
        location: s.location || "",
      },
    });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
