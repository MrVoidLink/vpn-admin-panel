// /api/servers.js
export const runtime = "nodejs";
import { db } from "../lib/firebase-admin.js";

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
const S = (v) => (v == null ? "" : String(v).trim().toLowerCase());

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  try {
    const qp = req.query;
    const typeRaw       = Array.isArray(qp.type) ? qp.type[0] : qp.type;            // free|premium (اختیاری)
    const protocolRaw   = Array.isArray(qp.protocol) ? qp.protocol[0] : qp.protocol; // openvpn|wireguard (اختیاری)
    const includeVarRaw = Array.isArray(qp.includeVariants) ? qp.includeVariants[0] : qp.includeVariants;
    const includeVariants = S(includeVarRaw) === "1" || S(includeVarRaw) === "true";

    let q = db.collection("servers");
    if (typeRaw) q = q.where("serverType", "==", S(typeRaw));

    const snap = await q.get();

    // سرورها (خام) + id
    let servers = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    // اگر پروتکل خواسته شده، با نگاه به SUMMARY (protocols[]) سریع فیلتر کن
    if (protocolRaw) {
      const want = S(protocolRaw);
      servers = servers.filter(s => Array.isArray(s.protocols) ? s.protocols.includes(want) : true);
    }

    // اگر includeVariants=true، واریانت‌های خام را هم ضمیمه کن
    if (includeVariants) {
      const withVars = await Promise.all(servers.map(async s => {
        const vSnap = await db.collection("servers").doc(s.id).collection("variants").get();
        const variants = vSnap.docs.map(v => ({ id: v.id, ...(v.data() || {}) }));
        // اگر protocol مشخص شده بود، اینجا هم فیلتر اعمال کن (بدون تغییر ساختار)
        const protocol = S(protocolRaw);
        const filtered = protocol ? variants.filter(v => S(v.protocol) === protocol) : variants;
        return { ...s, variants: filtered };
      }));
      servers = withVars;
    }

    return res.status(200).json({ ok: true, data: servers, count: servers.length });
  } catch (e) {
    console.error("GET /api/servers error:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
