// src/pages/AddServer.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import {
  FaServer, FaShieldAlt, FaPlus, FaTrash, FaCopy, FaCheck, FaTimes,
  FaMapMarkerAlt, FaGlobe, FaBolt, FaKey
} from "react-icons/fa";

/* ───────────────────────── Utils */
const S = (v) => (v == null ? "" : String(v).trim());
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s || ""));
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(S(s || ""));

/* ───────────────────────── Main */
const AddServer = ({ onCancel }) => {
  // ——— Common fields
  const [serverName, setServerName] = useState("");
  const [ipAddress, setIpAddress]   = useState("");
  const [serverType, setServerType] = useState("free"); // free | premium
  const [maxConnections, setMaxConnections] = useState(10);
  const [location, setLocation]     = useState("");
  const [country, setCountry]       = useState("");
  const [status, setStatus]         = useState("active"); // active | inactive
  const [description, setDescription] = useState("");
  const [pingMs, setPingMs]         = useState("");

  // ——— Variants
  const [variants, setVariants] = useState([
    {
      protocol: "openvpn",

      // OpenVPN
      ovpnProto: "udp", // udp | tcp
      port: 1194,
      configFileUrl: "",
      username: "",
      password: "",

      // WireGuard
      endpointHost: "",
      endpointPort: 51820,
      publicKey: "",
      address: "",
      dns: "",
      allowedIps: "",
      persistentKeepalive: "",
      mtu: "",
      preSharedKey: "",
      confFileUrl: "",
    },
  ]);

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Host/IP regex
  const ipRegex = useMemo(
    () => /^(\d{1,3}\.){3}\d{1,3}$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
    []
  );
  const isHostLike = (s) => ipRegex.test(S(s));

  /* ───────────────────────── Validation */
  const validateVariant = (v, idx) => {
    const e = {};
    if (!v.protocol || !["openvpn", "wireguard"].includes(v.protocol)) {
      e[`variants.${idx}.protocol`] = "Invalid protocol";
    }

    if (v.protocol === "openvpn") {
      if (!v.ovpnProto || !["udp", "tcp"].includes(v.ovpnProto)) {
        e[`variants.${idx}.ovpnProto`] = "udp or tcp";
      }
      if (!v.port || Number(v.port) < 1 || Number(v.port) > 65535) {
        e[`variants.${idx}.port`] = "Invalid port";
      }
      if (v.configFileUrl && !isHttpUrl(v.configFileUrl)) {
        e[`variants.${idx}.configFileUrl`] = "Config URL must be http(s)";
      }
    }

    if (v.protocol === "wireguard") {
      if (v.endpointHost && !isHostLike(v.endpointHost)) {
        e[`variants.${idx}.endpointHost`] = "Valid IP/host required";
      }
      if (!v.endpointPort || Number(v.endpointPort) < 1 || Number(v.endpointPort) > 65535) {
        e[`variants.${idx}.endpointPort`] = "Invalid port";
      }
      if (v.publicKey && !isBase64ish(v.publicKey)) {
        e[`variants.${idx}.publicKey`] = "Looks like an invalid base64 key";
      }
      if (v.allowedIps && !/^[0-9./,\s:]*$/.test(v.allowedIps)) {
        e[`variants.${idx}.allowedIps`] = "Comma-separated CIDRs";
      }
      if (v.persistentKeepalive && isNaN(Number(v.persistentKeepalive))) {
        e[`variants.${idx}.persistentKeepalive`] = "Number (seconds)";
      }
      if (v.mtu && isNaN(Number(v.mtu))) {
        e[`variants.${idx}.mtu`] = "Number";
      }
      if (v.confFileUrl && !isHttpUrl(v.confFileUrl)) {
        e[`variants.${idx}.confFileUrl`] = "Conf URL must be http(s)";
      }
    }
    return e;
  };

  const validate = () => {
    const e = {};
    if (!serverName) e.serverName = "Required";
    if (!ipAddress || !ipRegex.test(ipAddress)) e.ipAddress = "Valid IP/host required";
    if (!location) e.location = "Required";
    if (!country) e.country = "Required";
    if (!status) e.status = "Required";
    if (pingMs && (isNaN(Number(pingMs)) || Number(pingMs) < 0)) e.pingMs = "Invalid";

    if (!variants.length) {
      e.variants = "At least one variant is required";
    } else {
      variants.forEach((v, idx) => Object.assign(e, validateVariant(v, idx)));
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ───────────────────────── Mutators */
  const addVariant = (proto = "openvpn") => {
    setVariants((prev) => [
      ...prev,
      proto === "openvpn"
        ? {
            protocol: "openvpn",
            ovpnProto: "udp",
            port: 1194,
            configFileUrl: "",
            username: "",
            password: "",
            endpointHost: "",
            endpointPort: "",
            publicKey: "",
            address: "",
            dns: "",
            allowedIps: "",
            persistentKeepalive: "",
            mtu: "",
            preSharedKey: "",
            confFileUrl: "",
          }
        : {
            protocol: "wireguard",
            ovpnProto: "",
            port: "",
            configFileUrl: "",
            username: "",
            password: "",
            endpointHost: "",
            endpointPort: 51820,
            publicKey: "",
            address: "",
            dns: "",
            allowedIps: "",
            persistentKeepalive: "",
            mtu: "",
            preSharedKey: "",
            confFileUrl: "",
          },
    ]);
  };

  const duplicateVariant = (idx) => {
    setVariants((prev) => {
      const copy = JSON.parse(JSON.stringify(prev[idx]));
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  };

  const removeVariant = (idx) => setVariants((prev) => prev.filter((_, i) => i !== idx));

  const switchVariantProtocol = (idx, nextProto) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        if (nextProto === "openvpn") {
          return {
            ...v,
            protocol: "openvpn",
            ovpnProto: v.ovpnProto || "udp",
            port: v.port || 1194,
            // clean WG
            endpointHost: "",
            endpointPort: "",
            publicKey: "",
            address: "",
            dns: "",
            allowedIps: "",
            persistentKeepalive: "",
            mtu: "",
            preSharedKey: "",
            confFileUrl: "",
          };
        }
        return {
          ...v,
          protocol: "wireguard",
          endpointPort: v.endpointPort || 51820,
          // clean OVPN
          ovpnProto: "",
          port: "",
          configFileUrl: "",
          username: "",
          password: "",
          confFileUrl: v.confFileUrl || "",
        };
      })
    );
  };

  const patchVariant = (idx, patch) =>
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  /* ───────────────────────── Submit */
  const resetForm = () => {
    setServerName("");
    setIpAddress("");
    setServerType("free");
    setMaxConnections(10);
    setLocation("");
    setCountry("");
    setStatus("active");
    setDescription("");
    setPingMs("");
    setVariants([
      {
        protocol: "openvpn",
        ovpnProto: "udp",
        port: 1194,
        configFileUrl: "",
        username: "",
        password: "",
        endpointHost: "",
        endpointPort: 51820,
        publicKey: "",
        address: "",
        dns: "",
        allowedIps: "",
        persistentKeepalive: "",
        mtu: "",
        preSharedKey: "",
        confFileUrl: "",
      },
    ]);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setMessage(null);

    try {
      const normalizedVariants = variants.map((v) => {
        const out = { protocol: v.protocol };

        if (v.protocol === "openvpn") {
          out.ovpnProto = (v.ovpnProto || "udp").toLowerCase();
          out.port = Number(v.port) || 1194;
          if (v.configFileUrl) out.configFileUrl = v.configFileUrl.trim();
          if (v.username) out.username = v.username.trim();
          if (v.password) out.password = v.password.trim();
        }

        if (v.protocol === "wireguard") {
          if (v.endpointHost) out.endpointHost = v.endpointHost.trim();
          out.endpointPort = Number(v.endpointPort) || 51820;
          if (v.publicKey) out.publicKey = v.publicKey.trim();
          if (v.address) out.address = v.address.trim();
          if (v.dns) out.dns = v.dns.trim();
          if (v.allowedIps) out.allowedIps = v.allowedIps.trim();
          if (v.persistentKeepalive) out.persistentKeepalive = Number(v.persistentKeepalive);
          if (v.mtu) out.mtu = Number(v.mtu);
          if (v.preSharedKey) out.preSharedKey = v.preSharedKey.trim();
          if (v.confFileUrl) out.confFileUrl = v.confFileUrl.trim();
        }

        return out;
      });

      const payload = {
        serverName,
        ipAddress,
        serverType,
        maxConnections: Number(maxConnections) || 10,
        location,
        country,
        status,
        description,
        pingMs: pingMs === "" ? undefined : Number(pingMs),
        variants: normalizedVariants,
      };

      const { data } = await axios.post("/api/add-server", payload);
      if (data?.ok) {
        setMessage({ type: "success", text: "Server added." });
        resetForm();
      } else {
        throw new Error(data?.message || "Unknown error");
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ───────────────────────── Live Preview (sidebar) data */
  const previewKpis = useMemo(() => {
    const c = variants.length;
    const protos = Array.from(new Set(variants.map(v => v.protocol))).join(", ") || "—";
    const hasFiles = variants.some(v => v.configFileUrl || v.confFileUrl);
    return { count: c, protos, hasFiles };
  }, [variants]);

  /* ───────────────────────── UI */
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700">
            <FaServer />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Add Server</h1>
            <p className="text-xs text-gray-500">OpenVPN & WireGuard • real-world ready</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <KPI label="Variants" value={previewKpis.count} />
          <KPI label="Protocols" value={previewKpis.protos} />
          <KPI label="Files" value={previewKpis.hasFiles ? "Yes" : "No"} />
        </div>
      </div>

      {/* Layout: Form + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Server basics */}
          <section className="rounded-2xl border border-gray-200 p-5 bg-white shadow-sm">
            <h2 className="font-semibold mb-4">Server basics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *" value={serverName} onChange={setServerName} error={errors.serverName} disabled={loading} />
              <Field label="IP / Host *" value={ipAddress} onChange={setIpAddress} error={errors.ipAddress} disabled={loading} />
              <Select label="Type *" value={serverType} onChange={setServerType} disabled={loading}
                options={[{value:"free",label:"Free"},{value:"premium",label:"Premium"}]} />
              <Field label="Max Connections *" type="number" value={maxConnections} onChange={(v)=>setMaxConnections(Number(v))} disabled={loading} />
              <Field label="Location *" value={location} onChange={setLocation} error={errors.location} disabled={loading} icon={<FaMapMarkerAlt/>} />
              <Field label="Country *" value={country} onChange={setCountry} error={errors.country} disabled={loading} icon={<FaGlobe/>} />
              <Select label="Status *" value={status} onChange={setStatus} disabled={loading}
                options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} />
              <Field label="Ping (ms, optional)" value={pingMs} onChange={setPingMs} placeholder="e.g. 120" disabled={loading} />
            </div>
            <div className="mt-3">
              <label className="block mb-1 font-medium">Description</label>
              <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} className="w-full border px-3 py-2 rounded" disabled={loading} />
            </div>
          </section>

          {/* Variants */}
          <section className="rounded-2xl border border-gray-200 p-5 bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Connection Variants</h2>
              {errors.variants && <span className="text-sm text-red-600">{errors.variants}</span>}
            </div>

            {variants.map((v, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-4 bg-white">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <VariantPill v={v} />
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>duplicateVariant(idx)}
                      className="px-3 py-1 text-blue-700 border border-blue-300 rounded hover:bg-blue-50" disabled={loading} title="Duplicate">
                      <FaCopy /> 
                    </button>
                    <button type="button" onClick={()=>removeVariant(idx)}
                      className="px-3 py-1 text-red-700 border border-red-300 rounded hover:bg-red-50"
                      disabled={loading || variants.length === 1}
                      title={variants.length === 1 ? "At least one variant is required" : "Remove"}>
                      <FaTrash />
                    </button>
                  </div>
                </div>

                {/* Protocol switch */}
                <div className="mt-3">
                  <label className="block mb-1 font-medium">Protocol</label>
                  <select
                    value={v.protocol}
                    onChange={(e)=>switchVariantProtocol(idx, e.target.value)}
                    className="border px-3 py-2 rounded"
                    disabled={loading}
                  >
                    <option value="openvpn">OpenVPN</option>
                    <option value="wireguard">WireGuard</option>
                  </select>
                </div>

                {/* OpenVPN */}
                {v.protocol === "openvpn" && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Select label="Transport *" value={v.ovpnProto || "udp"} onChange={(val)=>patchVariant(idx,{ ovpnProto: val })}
                        options={[{value:"udp",label:"UDP"},{value:"tcp",label:"TCP"}]}
                        error={errors[`variants.${idx}.ovpnProto`]} disabled={loading} />
                      <Field label="Port *" type="number" value={v.port ?? ""} onChange={(val) => patchVariant(idx, { port: Number(val) })}
                        error={errors[`variants.${idx}.port`]} disabled={loading} />
                    </div>
                    <Field label="Config file URL (optional)" value={v.configFileUrl || ""} onChange={(val) => patchVariant(idx, { configFileUrl: val })}
                      error={errors[`variants.${idx}.configFileUrl`]} placeholder="https://.../server.ovpn" disabled={loading} />
                    <Field label="Username (optional)" value={v.username || ""} onChange={(val) => patchVariant(idx, { username: val })} disabled={loading} />
                    <Field label="Password (optional)" value={v.password || ""} onChange={(val) => patchVariant(idx, { password: val })} disabled={loading} />
                  </div>
                )}

                {/* WireGuard */}
                {v.protocol === "wireguard" && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Endpoint Host (optional)" value={v.endpointHost || ""} onChange={(val) => patchVariant(idx, { endpointHost: val })}
                      error={errors[`variants.${idx}.endpointHost`]} placeholder="defaults to server IP/host above" disabled={loading} />
                    <Field label="Endpoint Port *" type="number" value={v.endpointPort ?? ""} onChange={(val) => patchVariant(idx, { endpointPort: Number(val) })}
                      error={errors[`variants.${idx}.endpointPort`]} disabled={loading} />
                    <Field label="Config file URL (.conf, optional)" value={v.confFileUrl || ""} onChange={(val) => patchVariant(idx, { confFileUrl: val })}
                      error={errors[`variants.${idx}.confFileUrl`]} placeholder="https://.../client.conf" disabled={loading} />
                    <Field label="Server Public Key (base64, optional)" value={v.publicKey || ""} onChange={(val) => patchVariant(idx, { publicKey: val })}
                      error={errors[`variants.${idx}.publicKey`]} placeholder="server public key" disabled={loading} />
                    <Field label="Client Address (optional)" value={v.address || ""} onChange={(val) => patchVariant(idx, { address: val })}
                      placeholder="10.7.0.2/32" disabled={loading} />
                    <Field label="DNS (optional)" value={v.dns || ""} onChange={(val) => patchVariant(idx, { dns: val })} placeholder="1.1.1.1" disabled={loading} />
                    <Field label="Allowed IPs (optional)" value={v.allowedIps || ""} onChange={(val) => patchVariant(idx, { allowedIps: val })}
                      error={errors[`variants.${idx}.allowedIps`]} placeholder="0.0.0.0/0, ::/0" disabled={loading} />
                    <Field label="Persistent Keepalive (sec, optional)" value={v.persistentKeepalive || ""} onChange={(val) => patchVariant(idx, { persistentKeepalive: val })}
                      error={errors[`variants.${idx}.persistentKeepalive`]} placeholder="25" disabled={loading} />
                    <Field label="MTU (optional)" value={v.mtu || ""} onChange={(val) => patchVariant(idx, { mtu: val })}
                      error={errors[`variants.${idx}.mtu`]} placeholder="1420" disabled={loading} />
                    <Field label="Pre-shared Key (optional)" value={v.preSharedKey || ""} onChange={(val) => patchVariant(idx, { preSharedKey: val })}
                      placeholder="base64 psk" disabled={loading} />
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => addVariant("openvpn")}
                className="px-3 py-2 rounded border text-blue-700 border-blue-300 hover:bg-blue-50" disabled={loading}>
                + Add OpenVPN Variant
              </button>
              <button type="button" onClick={() => addVariant("wireguard")}
                className="px-3 py-2 rounded border text-purple-700 border-purple-300 hover:bg-purple-50" disabled={loading}>
                + Add WireGuard Variant
              </button>
            </div>
          </section>

          {/* Actions */}
          <footer className="flex justify-end gap-4">
            <button type="button" onClick={onCancel} className="px-5 py-2 rounded border border-gray-400 text-gray-700 hover:bg-gray-100" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={loading}>
              {loading ? "Saving..." : "Save Server"}
            </button>
          </footer>

          {message && (
            <p className={`mt-2 font-medium ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Right: Sticky Preview */}
        <aside className="h-fit lg:sticky lg:top-4 space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                <FaShieldAlt />
              </span>
              <h3 className="font-semibold">Live Preview</h3>
            </div>

            <div className="space-y-2 text-sm">
              <PreviewRow label="Name" value={serverName || "—"} />
              <PreviewRow label="IP/Host" value={ipAddress || "—"} />
              <PreviewRow label="Type" value={capitalize(serverType)} />
              <div className="grid grid-cols-2 gap-2">
                <PreviewRow label="Location" value={location || "—"} icon={<FaMapMarkerAlt />} />
                <PreviewRow label="Country" value={country || "—"} icon={<FaGlobe />} />
              </div>
              <PreviewRow label="Max Conn" value={String(maxConnections || "—")} />
              <PreviewRow label="Status" value={capitalize(status)} />
              <PreviewRow label="Ping" value={pingMs ? `${pingMs} ms` : "—"} />
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Variants</p>
              {variants.length === 0 ? (
                <p className="text-xs text-gray-500">No variants</p>
              ) : (
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <VariantPill v={v} />
                      <span className="text-[11px] text-gray-500">
                        {v.protocol === "openvpn"
                          ? (v.configFileUrl ? <HasFile /> : "—")
                          : (v.confFileUrl ? <HasFile /> : "—")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
};

/* ───────────────────────── UI bits */
function KPI({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl border bg-white min-w-[100px] text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

const Field = ({ label, value, onChange, type = "text", placeholder, error, disabled, icon }) => (
  <div className="mb-3">
    <label className="block mb-1 font-medium">{label}</label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border px-3 py-2 rounded ${icon ? "pl-9" : ""} ${error ? "border-red-500" : "border-gray-300"}`}
        disabled={disabled}
      />
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

function Select({ label, value, onChange, options, error, disabled }) {
  return (
    <div className="mb-3">
      <label className="block mb-1 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className={`w-full border px-3 py-2 rounded ${error ? "border-red-500" : "border-gray-300"}`}
        disabled={disabled}
      >
        {options.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

function VariantPill({ v }) {
  const isOVPN = v.protocol === "openvpn";
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full ${isOVPN ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
      {isOVPN ? <FaBolt/> : <FaKey/>}
      {isOVPN
        ? `OpenVPN ${(v.ovpnProto || "udp").toUpperCase()}:${v.port ?? "-"}`
        : `WireGuard :${v.endpointPort ?? "-"}`}
    </span>
  );
}

function PreviewRow({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-gray-500">{icon && <span className="text-gray-400">{icon}</span>}<span>{label}</span></div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}

function HasFile() {
  return (
    <span className="inline-flex items-center gap-1 text-green-700">
      <FaCheck className="text-green-600" /> file
    </span>
  );
}

function capitalize(s) { const t = S(s); return t ? t[0].toUpperCase() + t.slice(1) : ""; }

export default AddServer;
