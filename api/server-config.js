// /api/server-config.js
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
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "MISSING_ID" });

  try {
    const doc = await db.collection("servers").doc(id).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const s = doc.data() || {};

    // فقط active
    const status = String(s.status || "active").toLowerCase();
    if (status !== "active") {
      return res.status(403).json({ ok: false, error: "SERVER_INACTIVE" });
    }

    // خانواده v2ray
    const protocol = String(s.protocol || "v2ray").toLowerCase();
    if (protocol !== "v2ray") {
      return res.status(400).json({ ok: false, error: "ONLY_V2RAY_SUPPORTED" });
    }

    // فیلدهای دیتابیس
    const typeRaw    = String(s.v2rayType || "vless").toLowerCase();     // vless | vmess
    const networkRaw = String(s.v2rayNetwork || "ws").toLowerCase();     // ws | tcp
    const tls        = Boolean(s.v2rayTls ?? (networkRaw === "ws"));     // پیش‌فرض: ws→true
    const host       = String(s.v2rayHost || "").trim();                 // Host header/domain
    const uuid       = String(s.v2rayUuid || "").trim();
    const sni        = String(s.v2raySni || host).trim();
    const path       = ensureLeadingSlash(String(s.v2rayPath || "/"));
    const port       = Number(s.port) || (tls ? 443 : 80);

    // meta.host: جایی که کلاینت باید وصل شود (IP یا دامنه)
    const metaHost   = String(s.ipAddress || s.connectHost || host || "").trim();
    const metaPort   = Number(s.port) || (tls ? 443 : 80);

    // نرمال‌سازی نوع و شبکه
    const type    = (typeRaw === "vmess" ? "vmess" : "vless");
    const network = (networkRaw === "tcp" ? "tcp" : "ws"); // فقط ws یا tcp

    // اعتبارسنجی حداقلی
    if (!isUUID(uuid)) {
      return res.status(400).json({ ok: false, error: "INVALID_UUID" });
    }
    if (!metaHost) {
      return res.status(400).json({ ok: false, error: "MISSING_CONNECT_HOST" });
    }
    // برای ws، host header مفید است ولی اجباری نمی‌کنیم.
    // برای tcp، path نادیده گرفته می‌شود.

    // کانفیگ نهایی متناسب با اپ (ServerConfig.fromJson)
    const cfg = {
      protocol: "v2ray",
      type,                // vless | vmess
      network,             // ws | tcp
      tls,                 // true | false
      sni,                 // اگر خالی بود، همان host
      host,                // Host header/domain (برای ws)
      path: path,          // فقط برای ws کاربردی است
      uuid,
      meta: {
        host: metaHost,    // آدرس مقصد اتصال (IP یا دامنه)
        port: metaPort     // پورت مقصد اتصال
      }
    };

    // نکته: برای ws اگر HostHeader جداگانه‌ای داری (s.v2rayHostHeader)،
    // اپ از فیلد cfg.host به‌عنوان header استفاده می‌کند.

    return res.status(200).json({
      ok: true,
      id: doc.id,
      protocol: "v2ray",
      config: cfg,
      meta: {
        name: s.serverName || "",
        country: s.country || "",
        location: s.location || ""
      },
    });
  } catch (e) {
    console.error("GET /api/server-config failed:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
