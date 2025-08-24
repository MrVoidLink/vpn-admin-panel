// /api/add-server.js
import { db } from "../lib/firebase-admin.js";

const ALLOWED_PROTOCOLS = ["openvpn", "wireguard", "l2tp", "pptp", "v2ray"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // ---------- Normalization ----------
    const protocol = String(body.protocol || "").toLowerCase().trim();
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

    // ---------- Base validation ----------
    const baseErrors = [];
    if (!serverName) baseErrors.push("serverName");
    if (!ipAddress) baseErrors.push("ipAddress");
    if (!Number.isFinite(port) || port < 1 || port > 65535) baseErrors.push("port");
    if (!ALLOWED_PROTOCOLS.includes(protocol)) baseErrors.push("protocol");
    if (!serverType) baseErrors.push("serverType");
    if (!Number.isFinite(maxConnections) || maxConnections <= 0) baseErrors.push("maxConnections");
    if (!location) baseErrors.push("location");
    if (!country) baseErrors.push("country");
    if (!status) baseErrors.push("status");
    if (pingMs !== undefined && (!Number.isFinite(pingMs) || pingMs < 0)) baseErrors.push("pingMs");

    if (baseErrors.length) {
      return res.status(400).json({
        message: "Missing/invalid required fields",
        fields: baseErrors,
      });
    }

    // ---------- Protocol-specific validation ----------
    const protoErrors = [];

    if (protocol === "openvpn") {
      const configFileUrl = String(body.configFileUrl || "").trim();
      if (!configFileUrl) protoErrors.push("configFileUrl");
    }

    if (protocol === "wireguard") {
      const wgPublicKey = String(body.wgPublicKey || "").trim();
      const wgEndpoint  = String(body.wgEndpoint || "").trim(); // e.g. 1.2.3.4:51820
      if (!wgPublicKey) protoErrors.push("wgPublicKey");
      if (!wgEndpoint)  protoErrors.push("wgEndpoint");
      // optional: wgDns, wgAllowedIPs
    }

    if (protocol === "l2tp") {
      const l2tpPsk  = String(body.l2tpPsk || "").trim();
      const l2tpUser = String(body.l2tpUser || "").trim();
      const l2tpPass = String(body.l2tpPass || "").trim();
      if (!l2tpPsk)  protoErrors.push("l2tpPsk");
      if (!l2tpUser) protoErrors.push("l2tpUser");
      if (!l2tpPass) protoErrors.push("l2tpPass");
    }

    if (protocol === "pptp") {
      const pptpUser = String(body.pptpUser || "").trim();
      const pptpPass = String(body.pptpPass || "").trim();
      if (!pptpUser) protoErrors.push("pptpUser");
      if (!pptpPass) protoErrors.push("pptpPass");
    }

    if (protocol === "v2ray") {
      const v2rayType    = String(body.v2rayType || "").toLowerCase().trim();   // vless|vmess|...
      const v2rayUuid    = String(body.v2rayUuid || "").trim();
      const v2rayNetwork = String(body.v2rayNetwork || "").toLowerCase().trim(); // ws|grpc|tcp
      // optional: v2rayPath, v2rayHost, v2raySni, v2rayTls, v2rayFlow
      if (!v2rayType)    protoErrors.push("v2rayType");
      if (!v2rayUuid)    protoErrors.push("v2rayUuid");
      if (!v2rayNetwork) protoErrors.push("v2rayNetwork");
    }

    if (protoErrors.length) {
      return res.status(400).json({
        message: "Missing/invalid protocol-specific fields",
        fields: protoErrors,
      });
    }

    // ---------- Assemble payload to store ----------
    const payload = {
      // base
      serverName,
      ipAddress,
      port,
      protocol,       // normalized
      serverType,     // normalized
      maxConnections,
      location,
      country,
      status,         // normalized
      description,
      createdAt: new Date(),
    };

    if (pingMs !== undefined) {
      payload.pingMs = pingMs;
      payload.pingCheckedAt = new Date();
    }

    // protocol-specific (store as-is if present)
    if (protocol === "openvpn") {
      payload.configFileUrl = String(body.configFileUrl || "").trim();
    }

    if (protocol === "wireguard") {
      payload.wgPublicKey  = String(body.wgPublicKey || "").trim();
      payload.wgEndpoint   = String(body.wgEndpoint || "").trim();
      payload.wgDns        = String(body.wgDns ?? "1.1.1.1").trim();
      payload.wgAllowedIPs = String(body.wgAllowedIPs ?? "0.0.0.0/0, ::/0").trim();
    }

    if (protocol === "l2tp") {
      payload.l2tpPsk  = String(body.l2tpPsk || "").trim();
      payload.l2tpUser = String(body.l2tpUser || "").trim();
      payload.l2tpPass = String(body.l2tpPass || "").trim();
    }

    if (protocol === "pptp") {
      payload.pptpUser = String(body.pptpUser || "").trim();
      payload.pptpPass = String(body.pptpPass || "").trim();
    }

    if (protocol === "v2ray") {
      payload.v2rayType    = String(body.v2rayType || "").toLowerCase().trim();
      payload.v2rayUuid    = String(body.v2rayUuid || "").trim();
      payload.v2rayNetwork = String(body.v2rayNetwork || "").toLowerCase().trim();
      payload.v2rayPath    = String(body.v2rayPath || "").trim();
      payload.v2rayHost    = String(body.v2rayHost || "").trim();
      payload.v2raySni     = String(body.v2raySni || "").trim();
      payload.v2rayTls     = !!body.v2rayTls;
      if (String(body.v2rayFlow || "").trim()) {
        payload.v2rayFlow = String(body.v2rayFlow).trim();
      }
    }

    const ref = await db.collection("servers").add(payload);
    return res.status(200).json({ message: "Server added successfully", id: ref.id });
  } catch (error) {
    console.error("Error adding server:", error);
    return res
      .status(500)
      .json({ message: "Failed to add server", error: error.message });
  }
}
