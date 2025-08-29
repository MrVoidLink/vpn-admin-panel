// src/pages/ServerManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaServer, FaSyncAlt, FaSearch, FaSlidersH, FaList, FaThLarge,
  FaPlus, FaTrash, FaSave, FaTimes, FaPen, FaGlobe, FaMapMarkerAlt,
  FaChevronRight, FaChevronLeft, FaBolt, FaShieldAlt, FaKey
} from "react-icons/fa";

// ───────────── Utils
const S = (v) => (v == null ? "" : String(v));
const toNum = (v, d = undefined) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s).trim());
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(S(s));

export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid"); // grid | list
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [drawer, setDrawer] = useState({ open: false, server: null });

  const fetchServers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/server-management", { params: { action: "list" } });
      if (!data?.ok) throw new Error(data?.message || "Failed to load servers");
      setServers(data.servers || []);
    } catch (e) {
      console.error(e); alert("Failed to fetch servers.");
    }
    setLoading(false);
  };
  useEffect(() => { fetchServers(); }, []);

  const kpis = useMemo(() => {
    if (!servers.length) return { avgPing: "-", variants: 0 };
    const pings = servers.map(s => Number(s.pingMs)).filter(Number.isFinite);
    const avg = pings.length ? Math.round(pings.reduce((a,b)=>a+b,0)/pings.length) : "-";
    const variants = servers.reduce((a,s)=> a + (s.variantsCount||0), 0);
    return { avgPing: avg, variants };
  }, [servers]);

  const countries = useMemo(() => {
    const set = new Set(servers.map(s => S(s.country)).filter(Boolean));
    return ["", ...Array.from(set).sort()];
  }, [servers]);

  const visibleServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      const matchQ =
        !q || [s.serverName, s.ipAddress || s.host, s.location, s.country]
          .map((x) => S(x).toLowerCase()).some((x) => x.includes(q));
      const matchType = !typeFilter || S(s.serverType).toLowerCase() === typeFilter;
      const matchProto = !protocolFilter || (Array.isArray(s.protocols) && s.protocols.includes(protocolFilter));
      const matchCountry = !countryFilter || S(s.country) === countryFilter;
      return matchQ && matchType && matchProto && matchCountry;
    });
  }, [servers, search, typeFilter, protocolFilter, countryFilter]);

  const openDrawer = (srv) => setDrawer({ open: true, server: srv });
  const closeDrawer = () => setDrawer({ open: false, server: null });

  const deleteServer = async (serverId) => {
    const ok = window.confirm("Delete this server and ALL its variants?");
    if (!ok) return;
    try {
      const { data } = await axios.delete("/api/server-management", { params: { id: serverId } });
      if (!data?.ok) throw new Error(data?.message || "Delete failed");
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (drawer.server?.id === serverId) closeDrawer();
    } catch (e) {
      console.error(e); alert("Failed to delete server.");
    }
  };

  const refreshOneRow = async (id) => {
    try {
      const { data } = await axios.get("/api/server-management", { params: { action: "one", id } });
      if (data?.ok && data.server) {
        setServers((prev) => prev.map((s) => (s.id === id ? data.server : s)));
        if (drawer.server?.id === id) setDrawer((d)=>({ ...d, server: data.server }));
      }
    } catch {}
  };

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700">
            <FaServer />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Servers</h1>
            <p className="text-xs text-gray-500">Manage, filter, and edit your VPN endpoints</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="hidden md:flex items-center gap-3">
          <KPI label="Total" value={servers.length} />
          <KPI label="Avg Ping" value={kpis.avgPing === "-" ? "—" : `${kpis.avgPing} ms`} />
          <KPI label="Variants" value={kpis.variants} />
          <button
            className="ml-2 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 active:scale-95 transition"
            onClick={fetchServers}
            disabled={loading}
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Layout: Sidebar Filters + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-5">
        {/* Sidebar */}
        <aside className="rounded-2xl border bg-white p-4 h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <FaSlidersH /> Filters
          </div>
          <div className="space-y-3">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                placeholder="Search name, IP, location…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <Select label="Type" value={typeFilter} onChange={setTypeFilter}
              options={[{value:"",label:"All"},{value:"free",label:"Free"},{value:"premium",label:"Premium"}]} />
            <Select label="Protocol" value={protocolFilter} onChange={setProtocolFilter}
              options={[{value:"",label:"All"},{value:"openvpn",label:"OpenVPN"},{value:"wireguard",label:"WireGuard"}]} />
            <Select label="Country" value={countryFilter} onChange={setCountryFilter}
              options={countries.map(c=>({value:c,label:c||"All"}))} />

            <div className="pt-2 text-xs text-gray-500">
              <b>{visibleServers.length}</b> result{visibleServers.length===1?"":"s"}
            </div>
          </div>
        </aside>

        {/* Content */}
        <main>
          {/* Toolbar */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Showing <b>{visibleServers.length}</b> of <b>{servers.length}</b>
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                active={view==="grid"} onClick={()=>setView("grid")}
                icon={<FaThLarge />} label="Grid"
              />
              <Toggle
                active={view==="list"} onClick={()=>setView("list")}
                icon={<FaList />} label="List"
              />
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <CardSkeleton />
          ) : visibleServers.length === 0 ? (
            <EmptyState />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleServers.map(s => (
                <ServerCard
                  key={s.id}
                  srv={s}
                  onOpen={()=>openDrawer(s)}
                  onDelete={()=>deleteServer(s.id)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Name</Th><Th>IP/Host</Th><Th>Type</Th><Th>Location</Th>
                    <Th>Country</Th><Th>Protocols</Th><Th>Variants</Th><Th>Ping</Th><Th width="120">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibleServers.map((s,i)=>(
                    <tr key={s.id} className={i%2?"bg-gray-50/40":"bg-white"}>
                      <Td className="font-medium">{s.serverName||"-"}</Td>
                      <Td>{s.ipAddress || s.host || "-"}</Td>
                      <Td><Badge color={S(s.serverType)==="premium"?"amber":"blue"} text={s.serverType||"-"} capitalize/></Td>
                      <Td><IconText icon={<FaMapMarkerAlt />} text={s.location||"-"} /></Td>
                      <Td><IconText icon={<FaGlobe />} text={s.country||"-"} /></Td>
                      <Td>
                        {Array.isArray(s.protocols)&&s.protocols.length?(
                          <div className="flex flex-wrap gap-1">
                            {s.protocols.map(p=>(
                              <Badge key={p} color={p==="openvpn"?"green":"purple"} text={p} capitalize/>
                            ))}
                          </div>
                        ):"-"}
                      </Td>
                      <Td>{s.variantsCount ?? "-"}</Td>
                      <Td>{s.pingMs!=null?<Badge color={s.pingMs<120?"green":s.pingMs<220?"amber":"red"} text={`${s.pingMs} ms`}/>:"-"}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button className="px-2 py-1 rounded border text-blue-700 hover:bg-blue-50" onClick={()=>openDrawer(s)}>
                            Open
                          </button>
                          <button className="px-2 py-1 rounded border text-red-700 hover:bg-red-50" onClick={()=>deleteServer(s.id)}>
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Drawer */}
      {drawer.open && (
        <ServerDrawer
          server={drawer.server}
          onClose={closeDrawer}
          onAfterSave={()=>refreshOneRow(drawer.server.id)}
          onDelete={()=>deleteServer(drawer.server.id)}
        />
      )}
    </section>
  );
}

/* —————————————————— Components —————————————————— */

function KPI({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl border bg-white min-w-[100px] text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function Toggle({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function ServerCard({ srv, onOpen, onDelete }) {
  const pingColor = srv.pingMs==null ? "slate" : srv.pingMs<120 ? "green" : srv.pingMs<220 ? "amber" : "red";
  return (
    <div className="group rounded-2xl border bg-white p-4 hover:shadow-lg transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
            <FaShieldAlt />
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{srv.serverName || "Unnamed"}</h3>
            <p className="text-xs text-gray-500">{srv.ipAddress || srv.host || "—"}</p>
          </div>
        </div>
        <Badge color={S(srv.serverType)==="premium"?"amber":"blue"} text={srv.serverType||"-"} capitalize />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <IconText icon={<FaMapMarkerAlt />} text={srv.location || "-"} />
        <IconText icon={<FaGlobe />} text={srv.country || "-"} />
        <div className="col-span-2 flex flex-wrap gap-1">
          {Array.isArray(srv.protocols)&&srv.protocols.length
            ? srv.protocols.map(p=> <Badge key={p} color={p==="openvpn"?"green":"purple"} text={p} capitalize/>)
            : <span className="text-xs text-gray-500">No protocols</span>}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Badge color={pingColor} text={srv.pingMs!=null?`${srv.pingMs} ms`:"No ping"} />
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg border text-blue-700 hover:bg-blue-50" onClick={onOpen}>
            Details
          </button>
          <button className="px-3 py-1.5 rounded-lg border text-red-700 hover:bg-red-50" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ServerDrawer({ server, onClose, onAfterSave, onDelete }) {
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(defaultVariant("openvpn")); // shared form

  const change = (k,v)=> setDraft(d=>({...d,[k]:v}));

  const loadVariants = async () => {
    setVariantsLoading(true);
    try {
      const { data } = await axios.get("/api/server-management", { params: { serverId: server.id }});
      if (!data?.ok) throw new Error(data?.message || "Failed");
      setVariants(data.variants || []);
    } catch (e) { console.error(e); alert("Failed to load variants."); }
    setVariantsLoading(false);
  };
  useEffect(()=>{ loadVariants(); }, [server.id]);

  const [form, setForm] = useState({
    serverName: S(server.serverName),
    ipAddress: S(server.ipAddress || server.host),
    serverType: S(server.serverType || "free"),
    location: S(server.location),
    country: S(server.country),
    status: S(server.status || "active"),
    description: S(server.description),
    pingMs: server.pingMs ?? "",
    maxConnections: server.maxConnections ?? 10,
  });

  const saveServer = async () => {
    if (!form.serverName || !form.ipAddress) { alert("Name and IP/Host are required."); return; }
    setSaving(true);
    try {
      const payload = {
        id: server.id,
        serverName: form.serverName.trim(),
        ipAddress: form.ipAddress.trim(),
        serverType: form.serverType.trim(),
        location: form.location.trim(),
        country: form.country.trim(),
        status: form.status.trim(),
        description: form.description.trim(),
        maxConnections: toNum(form.maxConnections, 10),
        ...(form.pingMs === "" ? {} : { pingMs: toNum(form.pingMs) }),
      };
      const { data } = await axios.put("/api/server-management", payload);
      if (!data?.ok) throw new Error(data?.message || "Update failed");
      await onAfterSave?.();
    } catch(e){ console.error(e); alert("Failed to update server."); }
    setSaving(false);
  };

  const startAdd = (proto) => { setEditingId(null); setDraft(defaultVariant(proto)); };
  const startEdit = (v) => {
    setEditingId(v.id);
    setDraft({
      protocol: v.protocol || "openvpn",
      // OpenVPN
      ovpnProto: v.ovpnProto || "udp",
      port: v.port ?? 1194,
      configFileUrl: v.configFileUrl || "",
      username: v.username || "",
      password: v.password || "",
      // WireGuard
      endpointHost: v.endpointHost || "",
      endpointPort: v.endpointPort ?? 51820,
      confFileUrl: v.confFileUrl || "",
      publicKey: v.publicKey || "",
      address: v.address || "",
      dns: v.dns || "",
      allowedIps: v.allowedIps || "",
      persistentKeepalive: v.persistentKeepalive != null ? String(v.persistentKeepalive) : "",
      mtu: v.mtu != null ? String(v.mtu) : "",
      preSharedKey: v.preSharedKey || "",
    });
  };

  const saveVariant = async () => {
    const errs = validateVariant(draft);
    if (errs.length) { alert("Please fix:\n- " + errs.join("\n- ")); return; }
    try {
      if (editingId) {
        const { data } = await axios.put("/api/server-management", {
          action:"variant", serverId: server.id, variantId: editingId, variant: draft
        });
        if (!data?.ok) throw new Error(data?.message || "Variant update failed");
      } else {
        const { data } = await axios.post("/api/server-management", {
          action:"variant", serverId: server.id, variant: draft
        });
        if (!data?.ok) throw new Error(data?.message || "Variant add failed");
      }
      await loadVariants(); setEditingId(null); setDraft(defaultVariant("openvpn")); await onAfterSave?.();
    } catch(e){ console.error(e); alert("Failed to save variant."); }
  };

  const deleteVariant = async (variantId) => {
    const ok = window.confirm("Delete this variant?");
    if (!ok) return;
    try {
      const { data } = await axios.delete("/api/server-management", {
        params: { action:"variant", serverId: server.id, variantId }
      });
      if (!data?.ok) throw new Error(data?.message || "Variant delete failed");
      await loadVariants(); await onAfterSave?.();
    } catch(e){ console.error(e); alert("Failed to delete variant."); }
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-2xl p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border hover:bg-gray-50" onClick={onClose}><FaChevronRight className="rotate-180"/></button>
            <h3 className="text-lg font-bold">{server.serverName || "Server"}</h3>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-lg border text-red-700 hover:bg-red-50" onClick={onDelete}><FaTrash/> Delete</button>
            <button className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={saveServer} disabled={saving}>
              <FaSave /> {saving?"Saving...":"Save"}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Info label="IP/Host" value={server.ipAddress || server.host || "-"} />
          <Info label="Type" value={server.serverType || "-"} />
          <Info label="Location" value={server.location || "-"} />
          <Info label="Country" value={server.country || "-"} />
        </div>

        {/* Quick Edit */}
        <div className="rounded-xl border p-4 mb-5">
          <h4 className="font-semibold mb-3">Quick Edit</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name *" value={form.serverName} onChange={(v)=>setForm(f=>({...f, serverName:v}))}/>
            <Field label="IP/Host *" value={form.ipAddress} onChange={(v)=>setForm(f=>({...f, ipAddress:v}))}/>
            <Select label="Type" value={form.serverType} onChange={(v)=>setForm(f=>({...f, serverType:v}))}
              options={[{value:"free",label:"Free"},{value:"premium",label:"Premium"}]} />
            <Field label="Location" value={form.location} onChange={(v)=>setForm(f=>({...f, location:v}))}/>
            <Field label="Country" value={form.country} onChange={(v)=>setForm(f=>({...f, country:v}))}/>
            <Select label="Status" value={form.status} onChange={(v)=>setForm(f=>({...f, status:v}))}
              options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} />
            <Field label="Ping (ms)" type="number" value={form.pingMs} onChange={(v)=>setForm(f=>({...f, pingMs:v}))}/>
            <Field label="Max Connections" type="number" value={form.maxConnections} onChange={(v)=>setForm(f=>({...f, maxConnections:v}))}/>
          </div>
          <div className="mt-3">
            <label className="block mb-1 font-medium">Description</label>
            <textarea className="w-full border px-3 py-2 rounded" rows={3}
              value={form.description} onChange={(e)=>setForm(f=>({...f, description:e.target.value}))}/>
          </div>
        </div>

        {/* Variants */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Connection Variants</h4>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg border text-blue-700 hover:bg-blue-50" onClick={()=>startAdd("openvpn")}>+ OpenVPN</button>
              <button className="px-3 py-2 rounded-lg border text-purple-700 hover:bg-purple-50" onClick={()=>startAdd("wireguard")}>+ WireGuard</button>
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-lg border bg-gray-50 p-3 mb-4">
            <VariantEditor draft={draft} setDraft={setDraft} onSave={saveVariant} onCancel={()=>{ setEditingId(null); setDraft(defaultVariant("openvpn")); }} editingId={editingId}/>
          </div>

          {/* List */}
          {variantsLoading ? <p className="text-sm text-gray-500">Loading variants…</p> :
            variants.length===0 ? <p className="text-sm text-gray-500">No variants yet.</p> :
            <div className="space-y-2">
              {variants.map(v=>(
                <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-white hover:shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <VariantPill v={v}/>
                      <span className="text-xs text-gray-500">ID: {v.id.slice(0,6)}…</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700 space-y-1">
                      {v.protocol==="openvpn" ? (
                        <>
                          {v.configFileUrl && <LinkRow label="OVPN" href={v.configFileUrl}/>}
                          {(v.username||v.password) && <p>User/Pass: {v.username||"-"} / {v.password?"•••":"-"}</p>}
                        </>
                      ) : (
                        <>
                          {v.endpointHost && <p className="break-all">Endpoint: {v.endpointHost}:{v.endpointPort ?? "-"}</p>}
                          {v.confFileUrl && <LinkRow label="WG Conf" href={v.confFileUrl}/>}
                          {v.publicKey && <p className="break-all">PubKey: {v.publicKey}</p>}
                          {v.address && <p>Address: {v.address}</p>}
                          {v.dns && <p>DNS: {v.dns}</p>}
                          {v.allowedIps && <p className="break-all">Allowed IPs: {v.allowedIps}</p>}
                          {v.persistentKeepalive != null && <p>Keepalive: {v.persistentKeepalive}s</p>}
                          {v.mtu != null && <p>MTU: {v.mtu}</p>}
                          {v.preSharedKey && <p className="break-all">PSK: {v.preSharedKey}</p>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded-lg border text-blue-700 hover:bg-blue-50" onClick={()=>startEdit(v)}><FaPen/> Edit</button>
                    <button className="px-2 py-1 rounded-lg border text-red-700 hover:bg-red-50" onClick={()=>deleteVariant(v.id)}><FaTrash/> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>
    </div>
  );
}

/* —————————————————— Small bits —————————————————— */
function Info({ label, value }) {
  return <div className="text-sm"><span className="text-gray-500">{label}: </span><span className="font-medium break-all">{String(value)}</span></div>;
}
function IconText({ icon, text }) { return <div className="flex items-center gap-2 text-sm"><span className="text-gray-400">{icon}</span><span className="truncate">{text}</span></div>; }
function Badge({ text, color = "slate", capitalize = false }) {
  const map = {
    blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-800",
    green: "bg-green-100 text-green-700", purple: "bg-purple-100 text-purple-700",
    red: "bg-red-100 text-red-700", slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[color]} ${capitalize?"capitalize":""}`}>{text}</span>;
}
function Th({ children, width }) { return <th style={{width}} className="text-left p-3 text-xs font-semibold text-gray-600">{children}</th>; }
function Td({ children, className }) { return <td className={`p-3 ${className||""}`}>{children}</td>; }
function LinkRow({ label, href }) {
  return (
    <p className="break-all">
      {label}: <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">{href}</a>
    </p>
  );
}

/* —————————————————— Variant Editor + helpers —————————————————— */
function VariantPill({ v }) {
  const isOVPN = v.protocol==="openvpn";
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full ${isOVPN?"bg-green-100 text-green-700":"bg-purple-100 text-purple-700"}`}>
      {isOVPN ? <FaBolt/> : <FaKey/>}
      {isOVPN ? `OpenVPN ${(v.ovpnProto||"udp").toUpperCase()}:${v.port??"-"}` : `WireGuard :${v.endpointPort??"-"}`}
    </span>
  );
}

function VariantEditor({ draft, setDraft, onCancel, onSave, editingId }) {
  const [saving, setSaving] = useState(false);
  const change = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const submit = async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <label className="font-medium">Protocol</label>
          <select className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={draft.protocol} onChange={(e)=>change("protocol", e.target.value)}>
            <option value="openvpn">OpenVPN</option>
            <option value="wireguard">WireGuard</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded flex items-center gap-2" onClick={onCancel}><FaTimes/> Clear</button>
          <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2" onClick={submit} disabled={saving}>
            <FaSave/> {saving ? "Saving..." : editingId ? "Save changes" : "Add variant"}
          </button>
        </div>
      </div>

      {draft.protocol === "openvpn" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Transport *</label>
            <select className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={draft.ovpnProto || "udp"} onChange={(e)=>change("ovpnProto", e.target.value)}>
              <option value="udp">UDP</option><option value="tcp">TCP</option>
            </select>
          </div>
          <Field label="Port *" type="number" value={draft.port} onChange={(v)=>change("port", v)} />
          <Field label="Config file URL (optional)" value={draft.configFileUrl} onChange={(v)=>change("configFileUrl", v)} placeholder="https://.../server.ovpn" />
          <Field label="Username (optional)" value={draft.username} onChange={(v)=>change("username", v)} />
          <Field label="Password (optional)" value={draft.password} onChange={(v)=>change("password", v)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Endpoint Host (optional)" value={draft.endpointHost || ""} onChange={(v)=>change("endpointHost", v)} placeholder="defaults to server IP/host" />
          <Field label="Endpoint Port *" type="number" value={draft.endpointPort} onChange={(v)=>change("endpointPort", v)} />
          <Field label="Config file URL (.conf, optional)" value={draft.confFileUrl || ""} onChange={(v)=>change("confFileUrl", v)} placeholder="https://.../client.conf" />
          <Field label="Server Public Key (base64, optional)" value={draft.publicKey} onChange={(v)=>change("publicKey", v)} />
          <Field label="Client Address (optional)" value={draft.address} onChange={(v)=>change("address", v)} placeholder="10.7.0.2/32" />
          <Field label="DNS (optional)" value={draft.dns} onChange={(v)=>change("dns", v)} placeholder="1.1.1.1" />
          <Field label="Allowed IPs (optional)" value={draft.allowedIps} onChange={(v)=>change("allowedIps", v)} placeholder="0.0.0.0/0, ::/0" />
          <Field label="Persistent Keepalive (sec, optional)" value={draft.persistentKeepalive} onChange={(v)=>change("persistentKeepalive", v)} placeholder="25" />
          <Field label="MTU (optional)" value={draft.mtu} onChange={(v)=>change("mtu", v)} placeholder="1420" />
          <Field label="Pre-shared Key (optional)" value={draft.preSharedKey} onChange={(v)=>change("preSharedKey", v)} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block mb-1 font-medium">{label}</label>
      <input
        type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block mb-1 font-medium">{label}</label>
      <select
        className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
        value={value} onChange={(e)=>onChange(e.target.value)}
      >
        {options.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_,i)=>(
        <div key={i} className="rounded-2xl border bg-white p-4 animate-pulse">
          <div className="h-5 w-1/2 bg-gray-200 rounded mb-3" />
          <div className="h-3 w-1/3 bg-gray-200 rounded mb-3" />
          <div className="h-3 w-full bg-gray-200 rounded mb-2" />
          <div className="h-3 w-5/6 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md text-center py-12">
      <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500">
        <FaServer />
      </div>
      <p className="text-gray-700 font-medium">No servers match your filters</p>
      <p className="text-gray-500 text-sm">Try clearing search or changing filters.</p>
    </div>
  );
}

/* —————————————————— Logic helpers —————————————————— */
function defaultVariant(proto = "openvpn") {
  if (proto === "wireguard") {
    return {
      protocol: "wireguard",
      endpointHost: "",
      endpointPort: 51820,
      confFileUrl: "",
      publicKey: "",
      address: "",
      dns: "",
      allowedIps: "",
      persistentKeepalive: "",
      mtu: "",
      preSharedKey: "",
      ovpnProto: "",
      port: "",
      configFileUrl: "",
      username: "",
      password: "",
    };
  }
  return {
    protocol: "openvpn",
    ovpnProto: "udp",
    port: 1194,
    configFileUrl: "",
    username: "",
    password: "",
    endpointHost: "",
    endpointPort: "",
    confFileUrl: "",
    publicKey: "",
    address: "",
    dns: "",
    allowedIps: "",
    persistentKeepalive: "",
    mtu: "",
    preSharedKey: "",
  };
}

function validateVariant(v) {
  const errs = [];
  if (!["openvpn", "wireguard"].includes(v.protocol)) errs.push("protocol must be openvpn or wireguard");
  if (v.protocol === "openvpn") {
    const proto = String(v.ovpnProto || "udp").toLowerCase();
    if (!["udp","tcp"].includes(proto)) errs.push("openvpn.ovpnProto must be udp or tcp");
    const port = toNum(v.port); if (!Number.isFinite(port)||port<1||port>65535) errs.push("openvpn.port is invalid");
    if (v.configFileUrl && !isHttpUrl(v.configFileUrl)) errs.push("openvpn.configFileUrl must be http(s)");
  }
  if (v.protocol === "wireguard") {
    const port = toNum(v.endpointPort); if (!Number.isFinite(port)||port<1||port>65535) errs.push("wireguard.endpointPort is invalid");
    if (v.confFileUrl && !isHttpUrl(v.confFileUrl)) errs.push("wireguard.confFileUrl must be http(s)");
    if (v.publicKey && !isBase64ish(v.publicKey)) errs.push("wireguard.publicKey looks invalid");
    if (v.persistentKeepalive && !Number.isFinite(toNum(v.persistentKeepalive))) errs.push("wireguard.persistentKeepalive must be number");
    if (v.mtu && !Number.isFinite(toNum(v.mtu))) errs.push("wireguard.mtu must be number");
  }
  return errs;
}
