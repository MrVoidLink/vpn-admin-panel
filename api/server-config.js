// /api/server-config.js
export const runtime = "nodejs";
import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
const S = (v) => (v == null ? "" : String(v).trim());
const toNum = (v, d=undefined) => {
  const n = Number(v); return Number.isFinite(n) ? n : d;
};
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s));

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  try {
    const serverId  = S(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
    const variantId = S(Array.isArray(req.query.variantId) ? req.query.variantId[0] : req.query.variantId);

    if (!serverId) return res.status(400).json({ ok: false, error: "MISSING_ID" });

    // 1) سرور
    const sDoc = await db.collection("servers").doc(serverId).get();
    if (!sDoc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const s = sDoc.data() || {};
    if (S(s.status).toLowerCase() === "inactive") {
      return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });
    }

    // 2) واریانت
    let vDoc;
    if (variantId) {
      vDoc = await db.collection("servers").doc(serverId).collection("variants").doc(variantId).get();
      if (!vDoc.exists) return res.status(404).json({ ok: false, error: "VARIANT_NOT_FOUND" });
    } else {
      const vs = await db.collection("servers").doc(serverId).collection("variants").limit(2).get();
      if (vs.empty) return res.status(404).json({ ok: false, error: "NO_VARIANTS" });
      if (vs.size > 1) return res.status(400).json({ ok: false, error: "MULTIPLE_VARIANTS_REQUIRE_ID" });
      vDoc = vs.docs[0];
    }
    const v = vDoc.data() || {};
    const protocol = S(v.protocol).toLowerCase();

    const host = S(s.ipAddress || s.host);
    if (!host) return res.status(400).json({ ok: false, error: "MISSING_CONNECT_HOST" });

    // خروجی استاندارد
    let payload = {
      id: sDoc.id,
      protocol,
      type: S(s.serverType).toLowerCase() || null,
      config: {},
      meta: {
        name: S(s.serverName),
        country: S(s.country).toUpperCase(),
        location: S(s.location),
      },
    };

    if (protocol === "openvpn") {
      const port = toNum(v.port, 1194);
      const url  = S(v.configFileUrl);
      const username = S(v.username);
      const password = S(v.password);

      let configFile = null;
      if (isHttpUrl(url)) {
        // دانلود محتوا برای اپ (به‌جای URL)
        const resp = await fetch(url);
        if (!resp.ok) {
          return res.status(502).json({ ok: false, error: "OVPN_FETCH_FAILED" });
        }
        configFile = await resp.text();
      }

      payload.config = {
        protocol: "openvpn",
        ...(configFile ? { configFile } : {}),    // ← اپ همینو می‌خواد
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
        meta: { host, port },
      };
      return res.status(200).json({ ok: true, ...payload });
    }

    if (protocol === "wireguard") {
      const endpointHost = S(v.endpointHost) || host;
      const endpointPort = toNum(v.endpointPort, 51820);
      payload.config = {
        protocol: "wireguard",
        endpointHost,
        endpointPort,
        publicKey: S(v.publicKey),
        address: S(v.address),
        dns: v.dns || null,
        allowedIps: S(v.allowedIps),
        mtu: toNum(v.mtu),
        preSharedKey: S(v.preSharedKey),
        persistentKeepalive: toNum(v.persistentKeepalive),
        meta: { host: endpointHost, port: endpointPort },
      };
      return res.status(200).json({ ok: true, ...payload });
    }

    // پروتکل ناشناخته
    return res.status(400).json({ ok: false, error: "UNSUPPORTED_PROTOCOL" });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
