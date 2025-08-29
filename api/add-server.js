// /api/add-server.js
export const runtime = 'nodejs';

import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  allowCORS(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = req.body || {};

    // ---------- Common fields ----------
    const serverName     = String(body.serverName || "").trim();
    const ipAddress      = String(body.ipAddress  || body.host || "").trim();
    const port           = Number(body.port ?? 1194);
    const serverType     = String(body.serverType || "free").toLowerCase().trim();
    const maxConnections = Number(body.maxConnections ?? 10);
    const location       = String(body.location   || "").trim();
    const country        = String(body.country    || "").trim();
    const status         = String(body.status     || "active").toLowerCase().trim();
    const description    = String(body.description|| "").trim();
    const pingMs         = (body.pingMs === "" || body.pingMs == null) ? null : Number(body.pingMs);

    // ---------- OpenVPN-specific ----------
    const protocol       = "openvpn";
    const configFileUrl  = String(body.configFileUrl || "").trim(); // اختیاری
    const ovpnUsername   = String(body.ovpnUsername  || "").trim(); // اختیاری
    const ovpnPassword   = String(body.ovpnPassword  || "").trim(); // اختیاری

    // ---------- Validation ----------
    const errors = [];
    if (!serverName) errors.push("serverName");
    if (!ipAddress)  errors.push("ipAddress");
    if (!Number.isFinite(port) || port < 1 || port > 65535) errors.push("port");
    if (!serverType) errors.push("serverType");
    if (!Number.isFinite(maxConnections) || maxConnections <= 0) errors.push("maxConnections");
    if (!location)   errors.push("location");
    if (!country)    errors.push("country");
    if (!status)     errors.push("status");
    if (pingMs !== null && (!Number.isFinite(pingMs) || pingMs < 0)) errors.push("pingMs");

    if (errors.length) {
      return res.status(400).json({ ok: false, message: "INVALID_FIELDS", fields: errors });
    }

    // ---------- Write to Firestore ----------
    const serverPayload = {
      serverName,
      ipAddress,
      port,
      protocol,       // 'openvpn'
      serverType,
      maxConnections,
      location,
      country,
      status,
      description,
      ...(pingMs != null ? { pingMs } : {}),
      createdAt: new Date().toISOString(),
    };

    // ایجاد در 'servers' و استفاده از همان id برای 'serverConfigs'
    const ref = await db.collection("servers").add(serverPayload);

    // کانفیگ OpenVPN در کالکشن جدا
    const configPayload = {
      serverId: ref.id,
      protocol: "openvpn",
      ...(configFileUrl ? { configFileUrl } : {}),
      ...(ovpnUsername  ? { username: ovpnUsername } : {}),
      ...(ovpnPassword  ? { password: ovpnPassword } : {}),
      meta: { host: ipAddress, port },
    };
    await db.collection("serverConfigs").doc(ref.id).set(configPayload);

    return res.status(200).json({ ok: true, message: "Server added successfully", id: ref.id });
  } catch (error) {
    console.error("POST /api/add-server error:", error);
    return res.status(500).json({ ok: false, message: "INTERNAL_ERROR" });
  }
}
