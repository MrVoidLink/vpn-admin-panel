// api/update-pings.js
// پینگ TCP همه‌ی سرورهای active و ذخیره در Firestore (فیلد pingMs)
import { db } from "../lib/firebase-admin.js";
import net from "net";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// اتصال TCP کوتاه؛ ms اگر وصل شد، null اگر timeout/error
function tcpPing(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve(val);
    };
    sock.setTimeout(timeout);
    sock.once("connect", () => finish(Date.now() - start));
    sock.once("timeout", () => finish(null));
    sock.once("error",  () => finish(null));
    try { sock.connect({ host, port }); } catch { finish(null); }
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  try {
    // فقط active ها
    const snap = await db.collection("servers").where("status", "in", ["active","Active","ACTIVE"]).get();
    const servers = [];
    snap.forEach((doc) => {
      const s = doc.data() || {};
      const host = s.ipAddress || s.host || "";
      const port = Number(s.port) || 0;
      if (!host || !port) return;
      servers.push({ id: doc.id, host, port });
    });

    if (!servers.length) {
      return res.status(200).json({ ok: true, updated: 0, results: [] });
    }

    const results = [];
    for (const it of servers) {
      // 2 بار تست کن؛ بهترین رو ذخیره کن
      const a = await tcpPing(it.host, it.port, 2000);
      await sleep(120);
      const b = await tcpPing(it.host, it.port, 2000);
      const samples = [a,b].filter((x) => x !== null).sort((x,y)=>x-y);
      const pingMs = samples.length ? samples[0] : 9999;

      await db.collection("servers").doc(it.id).update({
        pingMs,
        pingCheckedAt: new Date(),
      });

      results.push({ id: it.id, host: it.host, port: it.port, pingMs });
      await sleep(80);
    }

    return res.status(200).json({ ok: true, updated: results.length, results });
  } catch (e) {
    console.error("update-pings error:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message || e) });
  }
}
