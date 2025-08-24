// /api/server-config.js
// Get a full connection config for a given server id
// Query: id=<serverId>
//
// Response shape (examples):
//  { ok: true, id, protocol: "openvpn", ovpn: "<file content>" }
//  { ok: true, id, protocol: "wireguard", config: { endpoint, serverPublicKey, allowedIPs, dns } }
//  { ok: true, id, protocol: "v2ray", config: { type, uuid, network, host, path, sni, tls, flow } }
//  { ok: true, id, protocol: "l2tp",   config: { server, psk, username, password } }
//  { ok: true, id, protocol: "pptp",   config: { server, username, password } }

import { db } from "../lib/firebase-admin.js";

// اگر روی Node خالی هستی و fetch نداری، اینو باز کن و نصب کن:
// import fetch from "node-fetch";

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

    // سرور غیرفعال را برنگردان (در صورت نیاز این شرط را حذف/تغییر بده)
    const status = String(s.status || "active").toLowerCase();
    if (status !== "active") {
      return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });
    }

    const protocol = String(s.protocol || "").toLowerCase();

    // ---------- OPENVPN ----------
    if (protocol === "openvpn") {
      const configFileUrl = String(s.configFileUrl || "").trim();
      if (!configFileUrl) {
        return res.status(400).json({ ok: false, error: "MISSING_CONFIG_URL" });
      }
      let ovpnText = "";
      try {
        const r = await fetch(configFileUrl, { method: "GET" });
        if (!r.ok) throw new Error(`Fetch ovpn failed: ${r.status}`);
        ovpnText = await r.text();
      } catch (e) {
        // اگر نخواستی فایل رو از URL بخونی، می‌تونی محتوای ovpn رو مستقیماً در فایربیس ذخیره کنی (ovpnInline)
        const inline = String(s.ovpnInline || "");
        if (inline) {
          ovpnText = inline;
        } else {
          return res.status(502).json({ ok: false, error: "OVPN_FETCH_FAILED", detail: String(e.message || e) });
        }
      }
      return res.status(200).json({
        ok: true,
        id: doc.id,
        protocol: "openvpn",
        ovpn: ovpnText,
        meta: {
          host: s.ipAddress || s.host || "",
          port: Number(s.port) || null,
          country: s.country || "",
          name: s.serverName || "",
        },
      });
    }

    // ---------- WIREGUARD ----------
    if (protocol === "wireguard") {
      const serverPublicKey = String(s.wgPublicKey || "").trim();
      const endpoint       = String(s.wgEndpoint || "").trim(); // e.g. 1.2.3.4:51820
      if (!serverPublicKey || !endpoint) {
        return res.status(400).json({ ok: false, error: "MISSING_WG_FIELDS" });
      }

      // کلید کلاینت: راهکار ساده (سمت سرور بساز/مدیریت کن) — الان حداقل پاسخ
      // اگر کلید کلاینت را بیرون می‌سازی، این جای پاسخ را پر کن
      const clientPrivateKey = String(s.clientPrivateKey || "");
      const clientPublicKey  = String(s.clientPublicKey || "");

      const allowedIPs = String(s.wgAllowedIPs || "0.0.0.0/0, ::/0");
      const dns        = String(s.wgDns || "1.1.1.1");

      return res.status(200).json({
        ok: true,
        id: doc.id,
        protocol: "wireguard",
        config: {
          endpoint,
          serverPublicKey,
          clientPrivateKey: clientPrivateKey || undefined,
          clientPublicKey: clientPublicKey || undefined,
          allowedIPs,
          dns,
        },
        meta: {
          host: s.ipAddress || "",
          port: Number(s.port) || null,
          country: s.country || "",
          name: s.serverName || "",
        },
      });
    }

    // ---------- V2RAY ----------
    if (protocol === "v2ray") {
      const cfg = {
        type:    String(s.v2rayType || "").toLowerCase(),        // vless|vmess|...
        uuid:    String(s.v2rayUuid || ""),
        network: String(s.v2rayNetwork || "").toLowerCase(),      // ws|grpc|tcp
        host:    String(s.v2rayHost || ""),
        path:    String(s.v2rayPath || ""),
        sni:     String(s.v2raySni || ""),
        tls:     !!s.v2rayTls,
      };
      if (String(s.v2rayFlow || "").trim()) cfg.flow = String(s.v2rayFlow).trim();

      // حداقل‌های لازم:
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
    }

    // ---------- L2TP ----------
    if (protocol === "l2tp") {
      const psk  = String(s.l2tpPsk || "");
      const user = String(s.l2tpUser || "");
      const pass = String(s.l2tpPass || "");
      if (!psk || !user || !pass) {
        return res.status(400).json({ ok: false, error: "MISSING_L2TP_FIELDS" });
      }
      return res.status(200).json({
        ok: true,
        id: doc.id,
        protocol: "l2tp",
        config: {
          server: s.ipAddress || "",
          psk,
          username: user,
          password: pass,
        },
        meta: {
          host: s.ipAddress || "",
          port: Number(s.port) || null,
          country: s.country || "",
          name: s.serverName || "",
        },
      });
    }

    // ---------- PPTP ----------
    if (protocol === "pptp") {
      const user = String(s.pptpUser || "");
      const pass = String(s.pptpPass || "");
      if (!user || !pass) {
        return res.status(400).json({ ok: false, error: "MISSING_PPTP_FIELDS" });
      }
      return res.status(200).json({
        ok: true,
        id: doc.id,
        protocol: "pptp",
        config: {
          server: s.ipAddress || "",
          username: user,
          password: pass,
        },
        meta: {
          host: s.ipAddress || "",
          port: Number(s.port) || null,
          country: s.country || "",
          name: s.serverName || "",
        },
      });
    }

    // ناشناخته / پشتیبانی‌نشده
    return res.status(400).json({ ok: false, error: "UNSUPPORTED_PROTOCOL", protocol });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
