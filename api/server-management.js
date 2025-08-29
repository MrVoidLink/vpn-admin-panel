// /api/server-management.js
export const runtime = "nodejs";

import { db } from "../lib/firebase-admin.js";

// ───────────── Utils
function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
const S = (v) => (v == null ? "" : String(v));
const toNum = (v, d = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s).trim());
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(S(s));

// ───────────── Variants helpers
function validateVariant(v) {
  const errs = [];
  if (!["openvpn", "wireguard"].includes(v.protocol)) {
    errs.push("protocol must be openvpn or wireguard");
  }

  if (v.protocol === "openvpn") {
    // ovpnProto (udp|tcp)
    const ovpn = S(v.ovpnProto || "udp").toLowerCase();
    if (!["udp", "tcp"].includes(ovpn)) {
      errs.push("openvpn.ovpnProto must be udp or tcp");
    }
    const port = toNum(v.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      errs.push("openvpn.port is invalid");
    }
    if (v.configFileUrl && !isHttpUrl(v.configFileUrl)) {
      errs.push("openvpn.configFileUrl must be http(s)");
    }
  }

  if (v.protocol === "wireguard") {
    // endpointHost اختیاری است
    const port = toNum(v.endpointPort);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      errs.push("wireguard.endpointPort is invalid");
    }
    if (v.publicKey && !isBase64ish(v.publicKey)) {
      errs.push("wireguard.publicKey looks invalid");
    }
    if (v.persistentKeepalive && !Number.isFinite(toNum(v.persistentKeepalive))) {
      errs.push("wireguard.persistentKeepalive must be number");
    }
    if (v.mtu && !Number.isFinite(toNum(v.mtu))) {
      errs.push("wireguard.mtu must be number");
    }
    // NEW: confFileUrl (optional) must be http(s) if provided
    if (v.confFileUrl && !isHttpUrl(v.confFileUrl)) {
      errs.push("wireguard.confFileUrl must be http(s)");
    }
  }
  return errs;
}

function normalizeVariant(v, ipAddress) {
  const out = {
    protocol: v.protocol,                // "openvpn" | "wireguard"
    meta: { host: S(ipAddress).trim() }, // برای کلاینت
  };

  if (v.protocol === "openvpn") {
    // ovpnProto
    out.ovpnProto = S(v.ovpnProto || "udp").toLowerCase();
    out.port = toNum(v.port, 1194);
    if (v.configFileUrl) out.configFileUrl = S(v.configFileUrl).trim();
    if (v.username) out.username = S(v.username).trim();
    if (v.password) out.password = S(v.password).trim();
  } else {
    // endpointHost با fallback به ipAddress
    out.endpointHost = S(v.endpointHost) || S(ipAddress).trim();
    out.endpointPort = toNum(v.endpointPort, 51820);
    // NEW: WireGuard conf file URL
    if (v.confFileUrl) out.confFileUrl = S(v.confFileUrl).trim();
    if (v.publicKey) out.publicKey = S(v.publicKey).trim();
    if (v.address) out.address = S(v.address).trim();
    if (v.dns) out.dns = S(v.dns).trim();
    if (v.allowedIps) out.allowedIps = S(v.allowedIps).trim();
    if (v.persistentKeepalive) out.persistentKeepalive = toNum(v.persistentKeepalive);
    if (v.mtu) out.mtu = toNum(v.mtu);
    if (v.preSharedKey) out.preSharedKey = S(v.preSharedKey).trim();
  }
  return out;
}

async function refreshServerSummary(serverId) {
  const snap = await db.collection("servers").doc(serverId).collection("variants").get();
  const list = [];
  snap.forEach((d) => list.push(d.data()));
  const protocols = Array.from(
    new Set(
      list
        .map((v) => S(v.protocol).toLowerCase().trim())
        .filter(Boolean)
    )
  );
  const variantsCount = list.length;

  await db.collection("servers").doc(serverId).update({
    protocols,
    variantsCount,
    updatedAt: new Date().toISOString(),
  });

  return { protocols, variantsCount };
}

// ───────────── Handler
export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const method = req.method;
    const q = req.query || {};
    const action = S(q.action).toLowerCase().trim();
    const serverId = S(q.serverId).trim();
    const variantId = S(q.variantId).trim();

    // GET ONE SERVER (for row refresh)
    if (method === "GET" && action === "one") {
      const id = S(q.id).trim();
      if (!id) return res.status(400).json({ ok: false, message: "MISSING_ID" });
      const doc = await db.collection("servers").doc(id).get();
      if (!doc.exists) return res.status(404).json({ ok: false, message: "NOT_FOUND" });
      const v = doc.data() || {};
      return res.status(200).json({
        ok: true,
        server: {
          id: doc.id,
          serverName: v.serverName ?? "",
          ipAddress: v.ipAddress ?? v.host ?? "",
          serverType: v.serverType ?? "free",
          location: v.location ?? "",
          country: v.country ?? "",
          status: v.status ?? "active",
          description: v.description ?? "",
          pingMs: v.pingMs ?? null,
          maxConnections: v.maxConnections ?? null,
          protocols: Array.isArray(v.protocols) ? v.protocols : [],
          variantsCount: typeof v.variantsCount === "number" ? v.variantsCount : 0,
          createdAt: v.createdAt ?? null,
          updatedAt: v.updatedAt ?? null,
        },
      });
    }

    // LIST SERVERS
    if (method === "GET" && !serverId) {
      const snap = await db.collection("servers").get();
      const servers = snap.docs.map((d) => {
        const v = d.data() || {};
        return {
          id: d.id,
          serverName: v.serverName ?? "",
          ipAddress: v.ipAddress ?? v.host ?? "",
          serverType: v.serverType ?? "free",
          location: v.location ?? "",
          country: v.country ?? "",
          status: v.status ?? "active",
          description: v.description ?? "",
          pingMs: v.pingMs ?? null,
          maxConnections: v.maxConnections ?? null,
          protocols: Array.isArray(v.protocols) ? v.protocols : [],
          variantsCount: typeof v.variantsCount === "number" ? v.variantsCount : 0,
          createdAt: v.createdAt ?? null,
          updatedAt: v.updatedAt ?? null,
        };
      });
      return res.status(200).json({ ok: true, servers });
    }

    // LIST VARIANTS
    if (method === "GET" && serverId) {
      const vs = await db.collection("servers").doc(serverId).collection("variants").get();
      const variants = vs.docs.map((d) => ({ id: d.id, ...d.data() })); // شامل confFileUrl در WG اگر باشد
      return res.status(200).json({ ok: true, variants });
    }

    // UPDATE SERVER
    if (method === "PUT" && action !== "variant") {
      const body = req.body || {};
      const id = S(body.id).trim();
      if (!id) return res.status(400).json({ ok: false, message: "MISSING_ID" });

      // IP قبلی برای sync
      const prevDoc = await db.collection("servers").doc(id).get();
      const prev = prevDoc.exists ? (prevDoc.data() || {}) : {};
      const prevIp = prev.ipAddress || prev.host || null;

      const payload = {
        serverName: S(body.serverName).trim(),
        ipAddress: S(body.ipAddress || body.host).trim(),
        serverType: S(body.serverType || "free").trim(),
        location: S(body.location).trim(),
        country: S(body.country).trim(),
        status: S(body.status || "active").trim(),
        description: S(body.description).trim(),
      };
      if (body.maxConnections != null) payload.maxConnections = toNum(body.maxConnections, 10);
      if (body.pingMs !== "" && body.pingMs != null) payload.pingMs = toNum(body.pingMs);

      // حذف فیلدهای خالی
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] == null) delete payload[k];
      });

      await db.collection("servers").doc(id).update({
        ...payload,
        updatedAt: new Date().toISOString(),
      });

      // اگر IP/Host تغییر کرد، meta.host واریانت‌ها را sync کن
      const newIp = payload.ipAddress || null;
      if (newIp && newIp !== prevIp) {
        const vs = await db.collection("servers").doc(id).collection("variants").get();
        const b = db.batch();
        vs.forEach((d) => {
          const v = d.data() || {};
          const curHost = v?.meta?.host;
          if (curHost !== newIp) {
            b.update(d.ref, {
              meta: { host: newIp },
              updatedAt: new Date().toISOString(),
            });
          }
        });
        await b.commit();
      }

      return res.status(200).json({ ok: true });
    }

    // DELETE SERVER (+ all variants)
    if (method === "DELETE" && action !== "variant") {
      const id = S(q.id || (req.body && req.body.id)).trim();
      if (!id) return res.status(400).json({ ok: false, message: "MISSING_ID" });

      const vSnap = await db.collection("servers").doc(id).collection("variants").get();
      const batch = db.batch();
      vSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(db.collection("servers").doc(id));
      await batch.commit();

      return res.status(200).json({ ok: true });
    }

    // ADD VARIANT
    if (method === "POST" && action === "variant") {
      const body = req.body || {};
      const sId = S(body.serverId || serverId).trim();
      if (!sId) return res.status(400).json({ ok: false, message: "MISSING_SERVER_ID" });

      const serverDoc = await db.collection("servers").doc(sId).get();
      if (!serverDoc.exists) return res.status(404).json({ ok: false, message: "SERVER_NOT_FOUND" });
      const ipAddress = (serverDoc.data() || {}).ipAddress || (serverDoc.data() || {}).host || "";

      const variant = body.variant || {};
      const errs = validateVariant(variant);
      if (errs.length) {
        return res.status(400).json({ ok: false, message: "INVALID_VARIANT", errors: errs });
      }

      const payload = normalizeVariant(variant, ipAddress);
      const ref = await db.collection("servers").doc(sId).collection("variants").add({
        ...payload,
        createdAt: new Date().toISOString(),
      });

      const summary = await refreshServerSummary(sId);
      return res.status(200).json({ ok: true, id: ref.id, summary });
    }

    // UPDATE VARIANT
    if (method === "PUT" && action === "variant") {
      const body = req.body || {};
      const sId = S(body.serverId || serverId).trim();
      const vId = S(body.variantId || variantId).trim();
      if (!sId || !vId) {
        return res.status(400).json({ ok: false, message: "MISSING_IDS" });
      }

      const serverDoc = await db.collection("servers").doc(sId).get();
      if (!serverDoc.exists) return res.status(404).json({ ok: false, message: "SERVER_NOT_FOUND" });
      const ipAddress = (serverDoc.data() || {}).ipAddress || (serverDoc.data() || {}).host || "";

      const variant = body.variant || {};
      const errs = validateVariant(variant);
      if (errs.length) {
        return res.status(400).json({ ok: false, message: "INVALID_VARIANT", errors: errs });
      }

      const payload = normalizeVariant(variant, ipAddress);
      await db.collection("servers").doc(sId).collection("variants").doc(vId).update({
        ...payload,
        updatedAt: new Date().toISOString(),
      });

      const summary = await refreshServerSummary(sId);
      return res.status(200).json({ ok: true, summary });
    }

    // DELETE VARIANT
    if (method === "DELETE" && action === "variant") {
      const sId = S(q.serverId).trim();
      const vId = S(q.variantId).trim();
      if (!sId || !vId) return res.status(400).json({ ok: false, message: "MISSING_IDS" });

      await db.collection("servers").doc(sId).collection("variants").doc(vId).delete();
      const summary = await refreshServerSummary(sId);
      return res.status(200).json({ ok: true, summary });
    }

    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  } catch (err) {
    console.error("API /server-management error:", err);
    return res.status(500).json({ ok: false, message: "INTERNAL_ERROR" });
  }
}
