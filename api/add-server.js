// /api/add-server.js
export const runtime = 'nodejs';

import { db } from "../lib/firebase-admin.js";

// ————— Helpers
function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
const isHttpUrl = (s) => /^https?:\/\//i.test(String(s || "").trim());
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(String(s || ""));
const toNum = (v, d = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

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
    const serverType     = String(body.serverType || "free").toLowerCase().trim(); // free|premium
    const maxConnections = toNum(body.maxConnections, 10);
    const location       = String(body.location   || "").trim();
    const country        = String(body.country    || "").trim();
    const status         = String(body.status     || "active").toLowerCase().trim(); // active|inactive
    const description    = String(body.description|| "").trim();
    const pingMs         = (body.pingMs === "" || body.pingMs == null) ? null : toNum(body.pingMs);

    // ---------- Variants (array of connection options) ----------
    const variants = Array.isArray(body.variants) ? body.variants : [];

    // ---------- Validation (server) ----------
    const errors = [];
    if (!serverName) errors.push("serverName");
    if (!ipAddress)  errors.push("ipAddress");
    if (!serverType) errors.push("serverType");
    if (!Number.isFinite(maxConnections) || maxConnections <= 0) errors.push("maxConnections");
    if (!location)   errors.push("location");
    if (!country)    errors.push("country");
    if (!status)     errors.push("status");
    if (pingMs !== null && (!Number.isFinite(pingMs) || pingMs < 0)) errors.push("pingMs");

    // ---------- Validation (variants) ----------
    if (!variants.length) {
      errors.push("variants");
    } else {
      variants.forEach((raw, idx) => {
        const vErr = [];
        const protocol = String(raw.protocol || "").toLowerCase().trim();

        if (!["openvpn", "wireguard"].includes(protocol)) {
          vErr.push(`variants[${idx}].protocol`);
        }

        if (protocol === "openvpn") {
          const port = toNum(raw.port);
          if (!Number.isFinite(port) || port < 1 || port > 65535) {
            vErr.push(`variants[${idx}].port`);
          }
          if (raw.configFileUrl && !isHttpUrl(raw.configFileUrl)) {
            vErr.push(`variants[${idx}].configFileUrl`);
          }
          // username/password اختیاری‌اند
        }

        if (protocol === "wireguard") {
          const endpointPort = toNum(raw.endpointPort);
          if (!Number.isFinite(endpointPort) || endpointPort < 1 || endpointPort > 65535) {
            vErr.push(`variants[${idx}].endpointPort`);
          }
          if (raw.publicKey && !isBase64ish(raw.publicKey)) {
            vErr.push(`variants[${idx}].publicKey`);
          }
          if (raw.persistentKeepalive != null && !Number.isFinite(toNum(raw.persistentKeepalive))) {
            vErr.push(`variants[${idx}].persistentKeepalive`);
          }
          if (raw.mtu != null && !Number.isFinite(toNum(raw.mtu))) {
            vErr.push(`variants[${idx}].mtu`);
          }
          // address/dns/allowedIps/preSharedKey همگی اختیاری‌اند (فرمت دقیق را اگر نیاز داشتی اضافه می‌کنیم)
        }

        if (vErr.length) errors.push(...vErr);
      });
    }

    if (errors.length) {
      return res.status(400).json({ ok: false, message: "INVALID_FIELDS", fields: errors });
    }

    // ---------- Write: server base ----------
    const serverPayload = {
      serverName,
      ipAddress,
      serverType,
      maxConnections,
      location,
      country,
      status,
      description,
      ...(pingMs != null ? { pingMs } : {}),
      // اطلاعات خلاصه برای سریع‌تر شدن کوئری‌ها
      protocols: Array.from(new Set(variants.map(v => String(v.protocol || "").toLowerCase().trim()))),
      variantsCount: variants.length,
      createdAt: new Date().toISOString(),
    };

    // base doc in 'servers'
    const ref = await db.collection("servers").add(serverPayload);

    // ---------- Write: variants (subcollection: servers/{id}/variants) ----------
    const batch = db.batch();
    const variantsCol = db.collection("servers").doc(ref.id).collection("variants");

    variants.forEach((raw) => {
      const protocol = String(raw.protocol || "").toLowerCase().trim();

      if (protocol === "openvpn") {
        const vDoc = variantsCol.doc();
        batch.set(vDoc, {
          protocol: "openvpn",
          port: toNum(raw.port, 1194),
          ...(raw.configFileUrl ? { configFileUrl: String(raw.configFileUrl).trim() } : {}),
          ...(raw.username ? { username: String(raw.username).trim() } : {}),
          ...(raw.password ? { password: String(raw.password).trim() } : {}),
          // اتصال سمت کلاینت از ipAddress پایه استفاده می‌کند
          meta: { host: ipAddress },
          createdAt: new Date().toISOString(),
        });
      }

      if (protocol === "wireguard") {
        const vDoc = variantsCol.doc();
        batch.set(vDoc, {
          protocol: "wireguard",
          endpointPort: toNum(raw.endpointPort, 51820),
          ...(raw.publicKey ? { publicKey: String(raw.publicKey).trim() } : {}),
          ...(raw.address ? { address: String(raw.address).trim() } : {}),
          ...(raw.dns ? { dns: String(raw.dns).trim() } : {}),
          ...(raw.allowedIps ? { allowedIps: String(raw.allowedIps).trim() } : {}),
          ...(raw.persistentKeepalive != null ? { persistentKeepalive: toNum(raw.persistentKeepalive) } : {}),
          ...(raw.mtu != null ? { mtu: toNum(raw.mtu) } : {}),
          ...(raw.preSharedKey ? { preSharedKey: String(raw.preSharedKey).trim() } : {}),
          meta: { host: ipAddress },
          createdAt: new Date().toISOString(),
        });
      }
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      message: "Server and variants added successfully",
      id: ref.id,
      variants: serverPayload.variantsCount,
    });
  } catch (error) {
    console.error("POST /api/add-server error:", error);
    return res.status(500).json({ ok: false, message: "INTERNAL_ERROR" });
  }
}
