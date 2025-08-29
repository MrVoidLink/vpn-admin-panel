// src/pages/AddServer.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";

const AddServer = ({ onCancel }) => {
  // ————— Common fields
  const [serverName, setServerName] = useState("");
  const [ipAddress, setIpAddress]   = useState("");
  const [serverType, setServerType] = useState("free"); // free | premium
  const [maxConnections, setMaxConnections] = useState(10);
  const [location, setLocation]     = useState("");
  const [country, setCountry]       = useState("");
  const [status, setStatus]         = useState("active"); // active | inactive
  const [description, setDescription] = useState("");
  const [pingMs, setPingMs]         = useState("");

  // ————— Variants (multi-protocol / multi-port)
  const [variants, setVariants] = useState([
    {
      protocol: "openvpn",

      // OpenVPN
      ovpnProto: "udp",   // udp | tcp
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
      // NEW (WireGuard file)
      confFileUrl: "",
    },
  ]);

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // IP/Hostname regex
  const ipRegex = useMemo(
    () => /^(\d{1,3}\.){3}\d{1,3}$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
    []
  );
  const isHttpUrl = (s) => /^https?:\/\//i.test(String(s || "").trim());
  const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(String(s || ""));
  const isHostLike = (s) => ipRegex.test(String(s || "").trim());

  // ───────────────────────────────────── Validation
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
      // NEW: WireGuard conf URL
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
      variants.forEach((v, idx) => {
        Object.assign(e, validateVariant(v, idx));
      });
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ───────────────────────────────────── Mutators
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
            // NEW
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

  const removeVariant = (idx) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  // وقتی پروتکل عوض می‌شود، فیلدهای تخصصی را معقول تنظیم کن
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
            // پاکسازی فیلدهای WireGuard
            endpointHost: "",
            endpointPort: "",
            publicKey: "",
            address: "",
            dns: "",
            allowedIps: "",
            persistentKeepalive: "",
            mtu: "",
            preSharedKey: "",
            // نگه‌داشتن confFileUrl برای WG؟ اینجا پاک می‌کنیم چون دیگه WG نیست
            confFileUrl: "",
          };
        } else {
          return {
            ...v,
            protocol: "wireguard",
            endpointPort: v.endpointPort || 51820,
            // پاکسازی فیلدهای OpenVPN
            ovpnProto: "",
            port: "",
            configFileUrl: "",
            username: "",
            password: "",
            // NEW: آماده‌سازی confFileUrl
            confFileUrl: v.confFileUrl || "",
          };
        }
      })
    );
  };

  const patchVariant = (idx, patch) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  // ───────────────────────────────────── Submit
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
    setVariants([{
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
    }]);
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
          // NEW: WG conf URL
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

  // ───────────────────────────────────── UI
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Add Server (OpenVPN & WireGuard)</h1>
        <div className="text-xs text-gray-500">Fields tuned for real connections</div>
      </header>

      {/* Common server fields */}
      <section className="rounded-2xl border border-gray-200 p-5 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">Server basics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *" value={serverName} onChange={setServerName} error={errors.serverName} disabled={loading} />
          <Field label="IP / Host *" value={ipAddress} onChange={setIpAddress} error={errors.ipAddress} disabled={loading} />
          <div>
            <label className="block mb-1 font-medium">Type *</label>
            <select value={serverType} onChange={(e)=>setServerType(e.target.value)} className="w-full border px-3 py-2 rounded" disabled={loading}>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <Field label="Max Connections *" type="number" value={maxConnections} onChange={(v)=>setMaxConnections(Number(v))} disabled={loading} />
          <Field label="Location *" value={location} onChange={setLocation} error={errors.location} disabled={loading} />
          <Field label="Country *" value={country} onChange={setCountry} error={errors.country} disabled={loading} />
          <div>
            <label className="block mb-1 font-medium">Status *</label>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full border px-3 py-2 rounded" disabled={loading}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
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
          <div key={idx} className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-3 items-center">
                <label className="font-medium">Protocol</label>
                <select
                  value={v.protocol}
                  onChange={(e) => switchVariantProtocol(idx, e.target.value)}
                  className="border px-3 py-2 rounded"
                  disabled={loading}
                >
                  <option value="openvpn">OpenVPN</option>
                  <option value="wireguard">WireGuard</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => duplicateVariant(idx)}
                  className="px-3 py-1 text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
                  disabled={loading}
                  title="Duplicate"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="px-3 py-1 text-red-700 border border-red-300 rounded hover:bg-red-50"
                  disabled={loading || variants.length === 1}
                  title={variants.length === 1 ? "At least one variant is required" : "Remove"}
                >
                  Remove
                </button>
              </div>
            </div>

            {/* OpenVPN fields */}
            {v.protocol === "openvpn" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium">Transport *</label>
                    <select
                      value={v.ovpnProto || "udp"}
                      onChange={(e)=>patchVariant(idx, { ovpnProto: e.target.value })}
                      className={`w-full border px-3 py-2 rounded ${errors[`variants.${idx}.ovpnProto`] ? "border-red-500" : "border-gray-300"}`}
                      disabled={loading}
                    >
                      <option value="udp">UDP</option>
                      <option value="tcp">TCP</option>
                    </select>
                    {errors[`variants.${idx}.ovpnProto`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`variants.${idx}.ovpnProto`]}</p>
                    )}
                  </div>
                  <Field
                    label="Port *"
                    type="number"
                    value={v.port ?? ""}
                    onChange={(val) => patchVariant(idx, { port: Number(val) })}
                    error={errors[`variants.${idx}.port`]}
                    disabled={loading}
                  />
                </div>
                <Field
                  label="Config file URL (optional)"
                  value={v.configFileUrl || ""}
                  onChange={(val) => patchVariant(idx, { configFileUrl: val })}
                  error={errors[`variants.${idx}.configFileUrl`]}
                  placeholder="https://.../server.ovpn"
                  disabled={loading}
                />
                <Field
                  label="Username (optional)"
                  value={v.username || ""}
                  onChange={(val) => patchVariant(idx, { username: val })}
                  disabled={loading}
                />
                <Field
                  label="Password (optional)"
                  value={v.password || ""}
                  onChange={(val) => patchVariant(idx, { password: val })}
                  disabled={loading}
                />
              </div>
            )}

            {/* WireGuard fields */}
            {v.protocol === "wireguard" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Endpoint Host (optional)"
                  value={v.endpointHost || ""}
                  onChange={(val) => patchVariant(idx, { endpointHost: val })}
                  error={errors[`variants.${idx}.endpointHost`]}
                  placeholder="defaults to server IP/host above"
                  disabled={loading}
                />
                <Field
                  label="Endpoint Port *"
                  type="number"
                  value={v.endpointPort ?? ""}
                  onChange={(val) => patchVariant(idx, { endpointPort: Number(val) })}
                  error={errors[`variants.${idx}.endpointPort`]}
                  disabled={loading}
                />
                {/* NEW: WireGuard conf file URL */}
                <Field
                  label="Config file URL (.conf, optional)"
                  value={v.confFileUrl || ""}
                  onChange={(val) => patchVariant(idx, { confFileUrl: val })}
                  error={errors[`variants.${idx}.confFileUrl`]}
                  placeholder="https://.../client.conf"
                  disabled={loading}
                />
                <Field
                  label="Server Public Key (base64, optional)"
                  value={v.publicKey || ""}
                  onChange={(val) => patchVariant(idx, { publicKey: val })}
                  error={errors[`variants.${idx}.publicKey`]}
                  placeholder="server public key"
                  disabled={loading}
                />
                <Field
                  label="Client Address (optional)"
                  value={v.address || ""}
                  onChange={(val) => patchVariant(idx, { address: val })}
                  placeholder="10.7.0.2/32"
                  disabled={loading}
                />
                <Field
                  label="DNS (optional)"
                  value={v.dns || ""}
                  onChange={(val) => patchVariant(idx, { dns: val })}
                  placeholder="1.1.1.1"
                  disabled={loading}
                />
                <Field
                  label="Allowed IPs (optional)"
                  value={v.allowedIps || ""}
                  onChange={(val) => patchVariant(idx, { allowedIps: val })}
                  error={errors[`variants.${idx}.allowedIps`]}
                  placeholder="0.0.0.0/0, ::/0"
                  disabled={loading}
                />
                <Field
                  label="Persistent Keepalive (sec, optional)"
                  value={v.persistentKeepalive || ""}
                  onChange={(val) => patchVariant(idx, { persistentKeepalive: val })}
                  error={errors[`variants.${idx}.persistentKeepalive`]}
                  placeholder="25"
                  disabled={loading}
                />
                <Field
                  label="MTU (optional)"
                  value={v.mtu || ""}
                  onChange={(val) => patchVariant(idx, { mtu: val })}
                  error={errors[`variants.${idx}.mtu`]}
                  placeholder="1420"
                  disabled={loading}
                />
                <Field
                  label="Pre-shared Key (optional)"
                  value={v.preSharedKey || ""}
                  onChange={(val) => patchVariant(idx, { preSharedKey: val })}
                  placeholder="base64 psk"
                  disabled={loading}
                />
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => addVariant("openvpn")}
            className="px-3 py-2 rounded border text-blue-700 border-blue-300 hover:bg-blue-50"
            disabled={loading}
          >
            + Add OpenVPN Variant
          </button>
          <button
            type="button"
            onClick={() => addVariant("wireguard")}
            className="px-3 py-2 rounded border text-purple-700 border-purple-300 hover:bg-purple-50"
            disabled={loading}
          >
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
    </form>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder, error, disabled }) => (
  <div className="mb-3">
    <label className="block mb-1 font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border px-3 py-2 rounded ${error ? "border-red-500" : "border-gray-300"}`}
      disabled={disabled}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

export default AddServer;
