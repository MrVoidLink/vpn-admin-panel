// /api/servers.js
import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// کوچک‌ساز امنِ رشته
const S = (v) => (v == null ? "" : String(v));

export default async function handler(req, res) {
  allowCORS(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    // ---------- Query params ----------
    const limitRaw    = Array.isArray(req.query.limit)    ? req.query.limit[0]    : req.query.limit;
    const typeRaw     = Array.isArray(req.query.type)     ? req.query.type[0]     : req.query.type;      // free|premium
    const protocolRaw = Array.isArray(req.query.protocol) ? req.query.protocol[0] : req.query.protocol;  // openvpn|wireguard

    let limit = parseInt(limitRaw ?? "100", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;

    const type     = S(typeRaw).trim().toLowerCase();
    const protocol = S(protocolRaw).trim().toLowerCase(); // اختیاری

    // ---------- Base query ----------
    // توجه: در مدل جدید، 'servers' شامل فیلدهای خلاصه است (protocols[], variantsCount)
    let q = db
      .collection("servers")
      .where("status", "==", "active");

    if (type) {
      q = q.where("serverType", "==", type);
    }
    if (protocol) {
      // فیلتر با استفاده از فیلد خلاصه‌ی protocols: ["openvpn","wireguard",...]
      q = q.where("protocols", "array-contains", protocol);
    }

    const snap = await q.limit(limit).get();

    // ---------- Shape response ----------
    const servers = snap.docs.map((d) => {
      const v = d.data() || {};
      return {
        id: d.id,
        // عمومی
        name: v.serverName ?? "",
        host: v.ipAddress ?? v.host ?? "",
        country: v.country ?? "",
        city: v.location ?? "",
        type: v.serverType ?? null,              // free | premium
        // خلاصهٔ واریانت‌ها
        protocols: Array.isArray(v.protocols) ? v.protocols : [],
        variantsCount: typeof v.variantsCount === "number" ? v.variantsCount : null,
        // متریک‌های اختیاری
        pingMs: v.pingMs ?? null,
        load: v.load ?? null,
        // زمان‌ها (اختیاری)
        createdAt: v.createdAt ?? null,
        updatedAt: v.updatedAt ?? null,
      };
    });

    return res.status(200).json({ ok: true, servers });
  } catch (e) {
    console.error("GET /api/servers error:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
