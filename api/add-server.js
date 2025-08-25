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

    // ---------- Normalization ----------
    let protocol = String(body.protocol || "").toLowerCase().trim();          // v2ray | vmess | vless
    const serverType = String(body.serverType || "free").toLowerCase().trim();
    const status = String(body.status || "active").toLowerCase().trim();

    const serverName = String(body.serverName || "").trim();
    const ipAddress  = String(body.ipAddress || "").trim();
    const location   = String(body.location || "").trim();
    const country    = String(body.country || "").trim();
    const description = String(body.description || "").trim();

    const port = Number(body.port);
    const maxConnections = Number(body.maxConnections);
    const pingMs = (body.pingMs === "" || body.pingMs == null) ? undefined : Number(body.pingMs);

    // اگر کاربر vmess/vless فرستاد، پروتکل را v2ray کن و زیرنوع را مشخص کن
    let v2rayTypeInput = String(body.v2rayType || "").toLowerCase().trim(); // vless|vmess
    if (protocol === "vmess" || protocol === "vless") {
      if (!v2rayTypeInput) v2rayTypeInput = protocol; // از خود مقدار protocol استفاده کن
      protocol = "v2ray";
    }

    // ---------- Base validation ----------
    const baseErrors = [];
    if (!serverName) baseErrors.push("serverName");
    if (!ipAddress) baseErrors.push("ipAddress");
    if (!Number.isFinite(port) || port < 1 || port > 65535) baseErrors.push("port");
    if (!["v2ray"].includes(protocol)) baseErrors.push("protocol"); // فقط v2ray
    if (!serverType) baseErrors.push("serverType");
    if (!Number.isFinite(maxConnections) || maxConnections <= 0) baseErrors.push("maxConnections");
    if (!location) baseErrors.push("location");
    if (!country) baseErrors.push("country");
    if (!status) baseErrors.push("status");
    if (pingMs !== undefined && (!Number.isFinite(pingMs) || pingMs < 0)) baseErrors.push("pingMs");

    // ---------- Protocol-specific validation (v2ray family) ----------
    const protoErrors = [];
    const v2rayUuid    = String(body.v2rayUuid || "").trim();
    const v2rayNetwork = String(body.v2rayNetwork || "").toLowerCase().trim(); // ws|grpc|tcp
    const v2rayPath    = String(body.v2rayPath || "").trim();
    const v2rayHost    = String(body.v2rayHost || "").trim();
    const v2raySni     = String(body.v2raySni || "").trim();
    const v2rayTls     = !!body.v2rayTls;
    const v2rayFlowRaw = String(body.v2rayFlow || "").trim();

    if (!v2rayTypeInput) protoErrors.push("v2rayType");
    if (!v2rayUuid)      protoErrors.push("v2rayUuid");
    if (!v2rayNetwork)   protoErrors.push("v2rayNetwork");

    if (baseErrors.length || protoErrors.length) {
      return res.status(400).json({
        ok: false,
        message: "Missing/invalid required fields",
        fields: { base: baseErrors, protocol: protoErrors },
      });
    }

    // ---------- Assemble payload ----------
    const payload = {
      serverName,
      ipAddress,
      port,
      protocol,           // همیشه "v2ray"
      serverType,         // free | premium
      maxConnections,
      location,
      country,
      status,             // active | inactive
      description,
      createdAt: new Date(),
      // optional metrics
      ...(pingMs !== undefined ? { pingMs, pingCheckedAt: new Date() } : {}),
      // v2ray fields
      v2rayType: v2rayTypeInput, // vless|vmess
      v2rayUuid,
      v2rayNetwork,              // ws|grpc|tcp
      v2rayPath,
      v2rayHost,
      v2raySni,
      v2rayTls,
      ...(v2rayFlowRaw ? { v2rayFlow: v2rayFlowRaw } : {}),
    };

    const ref = await db.collection("servers").add(payload);
    return res.status(200).json({ ok: true, message: "Server added successfully", id: ref.id });
  } catch (error) {
    console.error("POST /api/add-server error:", error);
    return res.status(500).json({ ok: false, message: "INTERNAL_ERROR" });
  }
}
