// /api/server-config.js  (نسخه‌ی اصلاح‌شده)
export const runtime = 'nodejs';

import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const ensureLeadingSlash = (p = "/") => {
  if (!p || typeof p !== "string") return "/";
  return p.startsWith("/") ? p : `/${p}`;
};
const isUUID = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test((v || "").trim());

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "MISSING_ID" });

  try {
    const doc = await db.collection("servers").doc(id).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const s = doc.data() || {};

    // فقط active
    const status = String(s.status || "active").toLowerCase();
    if (status !== "active") return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });

    // فقط خانواده v2ray
    const protocol = String(s.protocol || "").toLowerCase();
    if (protocol !== "v2ray") return res.status(400).json({ ok: false, error: "ONLY_V2RAY_SUPPORTED" });

    // فیلدهای v2ray دیتابیس شما
    const type    = String(s.v2rayType || "").toLowerCase();       // vless
    const network = String(s.v2rayNetwork || "").toLowerCase();    // ws
    const host    = String(s.v2rayHost || "").trim();
    const uuid    = String(s.v2rayUuid || "").trim();
    const sni     = String(s.v2raySni || host).trim();
    const path    = ensureLeadingSlash(String(s.v2rayPath || "/"));
    const port    = Number(s.port) || 443;
    const hostHdr = s.v2rayHostHeader ? String(s.v2rayHostHeader).trim() : "";

    // اعتبارسنجی ساده برای مدل «ساده»
    if (type !== "vless")   return res.status(400).json({ ok: false, error: "ONLY_VLESS_SUPPORTED" });
    if (network !== "ws")   return res.status(400).json({ ok: false, error: "ONLY_WS_SUPPORTED" });
    if (!host || !isUUID(uuid)) return res.status(400).json({ ok: false, error: "INVALID_VLESS_FIELDS" });

    // خروجی تمیز VLESS + WS + TLS (هیچ reality/xudp/flow موجود نیست)
    const cfg = {
      type: "vless",
      transport: "ws",
      tls: true,
      host,
      port,
      uuid,
      sni,
      ws: {
        path,
        ...(hostHdr ? { headers: { Host: hostHdr } } : {})
      }
    };

    return res.status(200).json({
      ok: true,
      id: doc.id,
      protocol: "v2ray",
      config: cfg,
      meta: {
        name: s.serverName || "",
        country: s.country || "",
      },
    });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
