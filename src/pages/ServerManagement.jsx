// src/pages/ServerManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaServer,
  FaSyncAlt,
  FaChevronDown,
  FaChevronRight,
  FaPlus,
  FaTrash,
  FaSave,
  FaTimes,
  FaPen,
} from "react-icons/fa";

// ───────────────────── Utils
const S = (v) => (v == null ? "" : String(v));
const toNum = (v, d = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s).trim());
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(S(s));

// ───────────────────── Main Page
export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null); // ردیف بازشده
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("");

  // بارگذاری لیست سرورها از API
  const fetchServers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/server-management", {
        params: { action: "list" }, // خواناتر
      });
      if (!data?.ok) throw new Error(data?.message || "Failed to load servers");
      setServers(data.servers || []);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch servers.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  // فیلتر/جست‌وجو در کلاینت (ساده)
  const visibleServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      const matchQ =
        !q ||
        [s.serverName, s.ipAddress || s.host, s.location, s.country]
          .map((x) => S(x).toLowerCase())
          .some((x) => x.includes(q));
      const matchType = !typeFilter || S(s.serverType).toLowerCase() === typeFilter;
      const matchProto =
        !protocolFilter ||
        (Array.isArray(s.protocols) && s.protocols.includes(protocolFilter));
      return matchQ && matchType && matchProto;
    });
  }, [servers, search, typeFilter, protocolFilter]);

  // حذف سرور (و همه variants) از API
  const deleteServer = async (serverId) => {
    const ok = window.confirm("Delete this server and ALL its variants?");
    if (!ok) return;
    try {
      const { data } = await axios.delete("/api/server-management", {
        params: { id: serverId },
      });
      if (!data?.ok) throw new Error(data?.message || "Delete failed");
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (expandedId === serverId) setExpandedId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete server.");
    }
  };

  // تازه‌سازی یک ردیف (بعد از ذخیره‌ی inline یا تغییر variants)
  const refreshOneRow = async (id) => {
    try {
      const { data } = await axios.get("/api/server-management", {
        params: { action: "one", id },
      });
      if (data?.ok && data.server) {
        setServers((prev) => prev.map((s) => (s.id === id ? data.server : s)));
      }
    } catch (e) {
      // بی‌صدا
    }
  };

  return (
    <section className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <FaServer className="text-blue-600 text-3xl" />
          <div>
            <h1 className="text-2xl font-bold">Server Management</h1>
            <span className="text-gray-500 text-sm">
              Total: <b>{servers.length}</b> | Visible: <b>{visibleServers.length}</b>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            placeholder="Search name / IP / location / country"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-2 rounded w-[280px]"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All types</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All protocols</option>
            <option value="openvpn">OpenVPN</option>
            <option value="wireguard">WireGuard</option>
          </select>
          <button
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 active:scale-95 transition-all"
            onClick={fetchServers}
            disabled={loading}
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-gray-100 text-sm text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-left rounded-tl-xl w-10"></th>
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">IP / Host</th>
              <th className="p-4 text-left">Type</th>
              <th className="p-4 text-left">Location</th>
              <th className="p-4 text-left">Country</th>
              <th className="p-4 text-left">Protocols</th>
              <th className="p-4 text-left">Variants</th>
              <th className="p-4 text-left">Ping</th>
              <th className="p-4 text-left rounded-tr-xl">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {visibleServers.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-500">
                  No servers to show.
                </td>
              </tr>
            ) : (
              visibleServers.map((srv, idx) => (
                <React.Fragment key={srv.id}>
                  <tr
                    className={`border-b last:border-none ${
                      expandedId === srv.id ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <td className="p-4 align-top">
                      <button
                        className="p-1 rounded border hover:bg-gray-100"
                        onClick={async () => {
                          const willOpen = expandedId !== srv.id;
                          setExpandedId((id) => (id === srv.id ? null : srv.id));
                          if (willOpen) {
                            // lazy-load variants when opening
                            // handled inside the expanded row component
                          }
                        }}
                        aria-label="Toggle row"
                      >
                        {expandedId === srv.id ? <FaChevronDown /> : <FaChevronRight />}
                      </button>
                    </td>
                    <td className="p-4">{srv.serverName || "-"}</td>
                    <td className="p-4">{srv.ipAddress || srv.host || "-"}</td>
                    <td className="p-4 capitalize">{srv.serverType || "-"}</td>
                    <td className="p-4">{srv.location || "-"}</td>
                    <td className="p-4">{srv.country || "-"}</td>
                    <td className="p-4">
                      {Array.isArray(srv.protocols) && srv.protocols.length
                        ? srv.protocols.join(", ")
                        : "-"}
                    </td>
                    <td className="p-4">
                      {typeof srv.variantsCount === "number"
                        ? srv.variantsCount
                        : "-"}
                    </td>
                    <td className="p-4">{srv.pingMs ?? "-"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1 rounded border text-red-700 hover:bg-red-50"
                          onClick={() => deleteServer(srv.id)}
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedId === srv.id && (
                    <tr className="bg-white">
                      <td colSpan={10} className="p-0">
                        <ExpandedRow
                          server={srv}
                          onServerSaved={async () => {
                            await refreshOneRow(srv.id);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ───────────────────── Expanded Row = Summary + Inline Edit + Variants
function ExpandedRow({ server, onServerSaved }) {
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
  const [saving, setSaving] = useState(false);

  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(true);

  // variant inline editor
  const [variantDraft, setVariantDraft] = useState(defaultVariant("openvpn"));
  const [editingVariantId, setEditingVariantId] = useState(null); // null = add

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadVariants = async () => {
    setVariantsLoading(true);
    try {
      const { data } = await axios.get("/api/server-management", {
        params: { serverId: server.id },
      });
      if (!data?.ok) throw new Error(data?.message || "Failed to load variants");
      setVariants(data.variants || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load variants.");
    }
    setVariantsLoading(false);
  };

  useEffect(() => {
    loadVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  const saveServer = async () => {
    if (!form.serverName || !form.ipAddress) {
      alert("Name and IP/Host are required.");
      return;
    }
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
      await onServerSaved?.();
    } catch (e) {
      console.error(e);
      alert("Failed to update server.");
    }
    setSaving(false);
  };

  const startAddVariant = (proto) => {
    setEditingVariantId(null);
    setVariantDraft(defaultVariant(proto));
  };

  const startEditVariant = (v) => {
    setEditingVariantId(v.id);
    setVariantDraft({
      protocol: v.protocol || "openvpn",
      // openvpn
      port: v.port ?? 1194,
      configFileUrl: v.configFileUrl || "",
      username: v.username || "",
      password: v.password || "",
      // wireguard
      endpointPort: v.endpointPort ?? 51820,
      publicKey: v.publicKey || "",
      address: v.address || "",
      dns: v.dns || "",
      allowedIps: v.allowedIps || "",
      persistentKeepalive:
        v.persistentKeepalive != null ? String(v.persistentKeepalive) : "",
      mtu: v.mtu != null ? String(v.mtu) : "",
      preSharedKey: v.preSharedKey || "",
    });
  };

  const cancelVariantEdit = () => {
    setEditingVariantId(null);
    setVariantDraft(defaultVariant("openvpn"));
  };

  const saveVariant = async () => {
    const errs = validateVariant(variantDraft);
    if (errs.length) {
      alert("Please fix:\n- " + errs.join("\n- "));
      return;
    }
    try {
      if (editingVariantId) {
        const { data } = await axios.put("/api/server-management", {
          action: "variant",
          serverId: server.id,
          variantId: editingVariantId,
          variant: variantDraft,
        });
        if (!data?.ok) throw new Error(data?.message || "Variant update failed");
      } else {
        const { data } = await axios.post("/api/server-management", {
          action: "variant",
          serverId: server.id,
          variant: variantDraft,
        });
        if (!data?.ok) throw new Error(data?.message || "Variant add failed");
      }
      await loadVariants();
      await onServerSaved?.(); // برای بروزرسانی protocols/variantsCount
      cancelVariantEdit();
    } catch (e) {
      console.error(e);
      alert("Failed to save variant.");
    }
  };

  const deleteVariant = async (variantId) => {
    const ok = window.confirm("Delete this variant?");
    if (!ok) return;
    try {
      const { data } = await axios.delete("/api/server-management", {
        params: { action: "variant", serverId: server.id, variantId },
      });
      if (!data?.ok) throw new Error(data?.message || "Variant delete failed");
      await loadVariants();
      await onServerSaved?.();
    } catch (e) {
      console.error(e);
      alert("Failed to delete variant.");
    }
  };

  const protocolsLabel =
    Array.isArray(server.protocols) && server.protocols.length
      ? server.protocols.join(", ")
      : "-";

  return (
    <div className="p-4 border-t bg-white">
      {/* Summary + Inline Edit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border p-4 bg-gray-50">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Info label="Name" value={server.serverName || "-"} />
              <Info label="IP/Host" value={server.ipAddress || server.host || "-"} />
              <Info label="Type" value={server.serverType || "-"} />
              <Info label="Location" value={server.location || "-"} />
              <Info label="Country" value={server.country || "-"} />
              <Info label="Ping" value={server.pingMs ?? "-"} />
              <Info label="Protocols" value={protocolsLabel} />
              <Info label="Variants" value={server.variantsCount ?? "-"} />
            </div>
          </div>
        </div>

        {/* Inline Edit */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Quick Edit</h3>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                  onClick={saveServer}
                  disabled={saving}
                >
                  <FaSave /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name *" value={form.serverName} onChange={(v) => change("serverName", v)} />
              <Field label="IP/Host *" value={form.ipAddress} onChange={(v) => change("ipAddress", v)} />
              <Select
                label="Type"
                value={form.serverType}
                onChange={(v) => change("serverType", v)}
                options={[
                  { value: "free", label: "Free" },
                  { value: "premium", label: "Premium" },
                ]}
              />
              <Field label="Location" value={form.location} onChange={(v) => change("location", v)} />
              <Field label="Country" value={form.country} onChange={(v) => change("country", v)} />
              <Select
                label="Status"
                value={form.status}
                onChange={(v) => change("status", v)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
              <Field label="Ping (ms)" type="number" value={form.pingMs} onChange={(v) => change("pingMs", v)} />
              <Field
                label="Max Connections"
                type="number"
                value={form.maxConnections}
                onChange={(v) => change("maxConnections", v)}
              />
            </div>

            <div className="mt-3">
              <label className="block mb-1 font-medium">Description</label>
              <textarea
                className="w-full border px-3 py-2 rounded"
                rows={3}
                value={form.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="mt-6 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Connection Variants</h3>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 border rounded text-blue-700 hover:bg-blue-50 flex items-center gap-2"
              onClick={() => startAddVariant("openvpn")}
              title="Add OpenVPN variant below"
            >
              <FaPlus /> OpenVPN
            </button>
            <button
              className="px-3 py-2 border rounded text-purple-700 hover:bg-purple-50 flex items-center gap-2"
              onClick={() => startAddVariant("wireguard")}
              title="Add WireGuard variant below"
            >
              <FaPlus /> WireGuard
            </button>
          </div>
        </div>

        {/* Inline variant editor */}
        <div className="mt-3 rounded-lg border p-3 bg-gray-50">
          <VariantEditor
            draft={variantDraft}
            setDraft={setVariantDraft}
            onCancel={cancelVariantEdit}
            onSave={saveVariant}
            editingId={editingVariantId}
          />
        </div>

        {/* List */}
        <div className="mt-4">
          {variantsLoading ? (
            <p className="text-sm text-gray-500">Loading variants…</p>
          ) : variants.length === 0 ? (
            <p className="text-sm text-gray-500">No variants yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {variants.map((v) => (
                <div key={v.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium capitalize">{v.protocol}</p>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded border text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                        onClick={() => startEditVariant(v)}
                        title="Edit"
                      >
                        <FaPen /> Edit
                      </button>
                      <button
                        className="px-2 py-1 rounded border text-red-700 hover:bg-red-50 flex items-center gap-1"
                        onClick={() => deleteVariant(v.id)}
                        title="Delete"
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>

                  {/* details */}
                  <div className="text-sm text-gray-700 space-y-1 mt-2">
                    {v.protocol === "openvpn" && (
                      <>
                        <p>Port: {v.port ?? "-"}</p>
                        {v.configFileUrl && (
                          <p className="break-all">
                            OVPN:{" "}
                            <a
                              href={v.configFileUrl}
                              className="text-blue-600 underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {v.configFileUrl}
                            </a>
                          </p>
                        )}
                        {(v.username || v.password) && (
                          <p>
                            User/Pass: {v.username || "-"} / {v.password ? "•••" : "-"}
                          </p>
                        )}
                      </>
                    )}
                    {v.protocol === "wireguard" && (
                      <>
                        <p>Endpoint Port: {v.endpointPort ?? "-"}</p>
                        {v.publicKey && <p className="break-all">Public Key: {v.publicKey}</p>}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────── Reusable bits
function Info({ label, value }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium break-all">{String(value)}</span>
    </p>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block mb-1 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border px-3 py-2 rounded"
      />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block mb-1 font-medium">{label}</label>
      <select
        className="w-full border px-3 py-2 rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ───────────────────── Variant Editor (inline)
function VariantEditor({ draft, setDraft, onCancel, onSave, editingId }) {
  const [saving, setSaving] = useState(false);
  const change = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <label className="font-medium">Protocol</label>
          <select
            className="border px-3 py-2 rounded"
            value={draft.protocol}
            onChange={(e) => change("protocol", e.target.value)}
          >
            <option value="openvpn">OpenVPN</option>
            <option value="wireguard">WireGuard</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded flex items-center gap-2" onClick={onCancel}>
            <FaTimes /> Clear
          </button>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
            onClick={submit}
            disabled={saving}
          >
            <FaSave /> {saving ? "Saving..." : editingId ? "Save changes" : "Add variant"}
          </button>
        </div>
      </div>

      {draft.protocol === "openvpn" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Port *" type="number" value={draft.port} onChange={(v) => change("port", v)} />
          <Field
            label="Config file URL (optional)"
            value={draft.configFileUrl}
            onChange={(v) => change("configFileUrl", v)}
            placeholder="https://.../server.ovpn"
          />
          <Field label="Username (optional)" value={draft.username} onChange={(v) => change("username", v)} />
          <Field label="Password (optional)" value={draft.password} onChange={(v) => change("password", v)} />
        </div>
      )}

      {draft.protocol === "wireguard" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Endpoint Port *" type="number" value={draft.endpointPort} onChange={(v) => change("endpointPort", v)} />
          <Field label="Server Public Key (base64, optional)" value={draft.publicKey} onChange={(v) => change("publicKey", v)} />
          <Field label="Client Address (optional)" value={draft.address} onChange={(v) => change("address", v)} placeholder="10.7.0.2/32" />
          <Field label="DNS (optional)" value={draft.dns} onChange={(v) => change("dns", v)} placeholder="1.1.1.1" />
          <Field label="Allowed IPs (optional)" value={draft.allowedIps} onChange={(v) => change("allowedIps", v)} placeholder="0.0.0.0/0, ::/0" />
          <Field label="Persistent Keepalive (sec, optional)" value={draft.persistentKeepalive} onChange={(v) => change("persistentKeepalive", v)} placeholder="25" />
          <Field label="MTU (optional)" value={draft.mtu} onChange={(v) => change("mtu", v)} placeholder="1420" />
          <Field label="Pre-shared Key (optional)" value={draft.preSharedKey} onChange={(v) => change("preSharedKey", v)} />
        </div>
      )}
    </div>
  );
}

// ───────────────────── Variant helpers (هم‌راستا با API)
function defaultVariant(proto = "openvpn") {
  if (proto === "wireguard") {
    return {
      protocol: "wireguard",
      endpointPort: 51820,
      publicKey: "",
      address: "",
      dns: "",
      allowedIps: "",
      persistentKeepalive: "",
      mtu: "",
      preSharedKey: "",
      // openvpn placeholders
      port: "",
      configFileUrl: "",
      username: "",
      password: "",
    };
  }
  return {
    protocol: "openvpn",
    port: 1194,
    configFileUrl: "",
    username: "",
    password: "",
    // wg placeholders
    endpointPort: "",
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
  if (!["openvpn", "wireguard"].includes(v.protocol)) {
    errs.push("protocol must be openvpn or wireguard");
  }
  if (v.protocol === "openvpn") {
    const port = toNum(v.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      errs.push("openvpn.port is invalid");
    }
    if (v.configFileUrl && !isHttpUrl(v.configFileUrl)) {
      errs.push("openvpn.configFileUrl must be http(s)");
    }
  }
  if (v.protocol === "wireguard") {
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
  }
  return errs;
}
