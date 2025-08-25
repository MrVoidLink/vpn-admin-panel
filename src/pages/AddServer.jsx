import React, { useMemo, useState } from "react";
import axios from "axios";

const AddServer = ({ onCancel }) => {
  // ————— Common fields
  const [serverName, setServerName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(443); // پیش‌فرض مناسب V2Ray/TLS
  const [serverType, setServerType] = useState("free");
  const [maxConnections, setMaxConnections] = useState(10);
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("active");
  const [description, setDescription] = useState("");
  const [pingMs, setPingMs] = useState("");

  // ————— V2Ray fields
  const [v2rayType, setV2rayType] = useState("vless");     // vless | vmess
  const [v2rayUuid, setV2rayUuid] = useState("");
  const [v2rayNetwork, setV2rayNetwork] = useState("ws");  // ws | grpc | tcp
  const [v2rayPath, setV2rayPath] = useState("/");
  const [v2rayHost, setV2rayHost] = useState("");
  const [v2raySni, setV2raySni] = useState("");
  const [v2rayTls, setV2rayTls] = useState(true);
  const [v2rayFlow, setV2rayFlow] = useState("");

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const ipRegex = useMemo(
    () => /^(?!0)(?!.*\.$)((1?\d{1,2}|2[0-4]\d|25[0-5])(\.|$)){4}$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/u,
    []
  );

  const validate = () => {
    const e = {};
    // Common
    if (!serverName.trim()) e.serverName = "Server name is required.";
    if (!ipAddress.trim()) e.ipAddress = "IP / Host is required.";
    if (ipAddress && !ipRegex.test(ipAddress))
      e.ipAddress = "Invalid IP/host format.";
    if (!port || port <= 0 || port > 65535)
      e.port = "Port must be between 1 and 65535.";
    if (!location.trim()) e.location = "Location is required.";
    if (!country.trim()) e.country = "Country is required.";
    if (!maxConnections || maxConnections <= 0)
      e.maxConnections = "Max connections must be positive.";

    // V2Ray
    if (!v2rayType) e.v2rayType = "Type is required.";
    if (!v2rayUuid.trim()) e.v2rayUuid = "UUID is required.";
    if (!v2rayNetwork) e.v2rayNetwork = "Transport is required.";
    if (v2rayTls && !v2raySni.trim() && !v2rayHost.trim()) {
      e.v2raySni = "SNI or Host is recommended when TLS is enabled.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage(null);

    const normalized = {
      serverName: serverName.trim(),
      ipAddress: ipAddress.trim(),
      port: Number(port),
      protocol: "v2ray", // فقط V2Ray
      serverType: (serverType || "free").toLowerCase(),
      maxConnections: Number(maxConnections),
      location: location.trim(),
      country: country.trim(),
      status: (status || "active").toLowerCase(),
      description: description.trim(),
    };

    if (pingMs !== "") {
      const p = Number(pingMs);
      if (!Number.isNaN(p) && p >= 0) normalized.pingMs = p;
    }

    // V2Ray fields
    normalized.v2rayType = (v2rayType || "vless").toLowerCase();
    normalized.v2rayUuid = v2rayUuid.trim();
    normalized.v2rayNetwork = (v2rayNetwork || "ws").toLowerCase();
    normalized.v2rayPath = v2rayPath.trim();
    normalized.v2rayHost = v2rayHost.trim();
    normalized.v2raySni = v2raySni.trim();
    normalized.v2rayTls = !!v2rayTls;
    if (v2rayFlow.trim()) normalized.v2rayFlow = v2rayFlow.trim();

    try {
      const res = await axios.post("/api/add-server", normalized);
      setMessage({ type: "success", text: res.data?.message || "Server added." });

      // reset
      setServerName("");
      setIpAddress("");
      setPort(443);
      setServerType("free");
      setMaxConnections(10);
      setLocation("");
      setCountry("");
      setStatus("active");
      setDescription("");
      setPingMs("");

      setV2rayType("vless");
      setV2rayUuid("");
      setV2rayNetwork("ws");
      setV2rayPath("/");
      setV2rayHost("");
      setV2raySni("");
      setV2rayTls(true);
      setV2rayFlow("");

      setErrors({});
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to add server.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex justify-center items-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-5"
      >
        <h1 className="text-2xl font-bold mb-6">Add New Server (V2Ray)</h1>

        {/* Common section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Server Name */}
          <div>
            <label className="block mb-1 font-medium">Server Name *</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className={`w-full border px-3 py-2 rounded ${errors.serverName ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
            />
            {errors.serverName && <p className="text-red-500 text-sm mt-1">{errors.serverName}</p>}
          </div>

          {/* IP / Host */}
          <div>
            <label className="block mb-1 font-medium">IP / Host *</label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className={`w-full border px-3 py-2 rounded ${errors.ipAddress ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
              placeholder="1.2.3.4 or vpn.example.com"
            />
            {errors.ipAddress && <p className="text-red-500 text-sm mt-1">{errors.ipAddress}</p>}
          </div>

          {/* Port */}
          <div>
            <label className="block mb-1 font-medium">Port *</label>
            <input
              type="number"
              value={port}
              min={1}
              max={65535}
              onChange={(e) => setPort(Number(e.target.value))}
              className={`w-full border px-3 py-2 rounded ${errors.port ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
            />
            {errors.port && <p className="text-red-500 text-sm mt-1">{errors.port}</p>}
          </div>

          {/* Server Type */}
          <div>
            <label className="block mb-1 font-medium">Server Type *</label>
            <select
              value={serverType}
              onChange={(e) => setServerType(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              disabled={loading}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          {/* Max Connections */}
          <div>
            <label className="block mb-1 font-medium">Max Connections *</label>
            <input
              type="number"
              value={maxConnections}
              min={1}
              onChange={(e) => setMaxConnections(Number(e.target.value))}
              className={`w-full border px-3 py-2 rounded ${errors.maxConnections ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
            />
            {errors.maxConnections && <p className="text-red-500 text-sm mt-1">{errors.maxConnections}</p>}
          </div>

          {/* Location */}
          <div>
            <label className="block mb-1 font-medium">Location *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={`w-full border px-3 py-2 rounded ${errors.location ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
              placeholder="Frankfurt, DE"
            />
            {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
          </div>

          {/* Country */}
          <div>
            <label className="block mb-1 font-medium">Country *</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`w-full border px-3 py-2 rounded ${errors.country ? "border-red-500" : "border-gray-300"}`}
              disabled={loading}
              placeholder="Germany"
            />
            {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country}</p>}
          </div>

          {/* Optional: ping (admin) */}
          <div>
            <label className="block mb-1 font-medium">Ping (ms)</label>
            <input
              type="number"
              value={pingMs}
              min={0}
              onChange={(e) => setPingMs(e.target.value)}
              className="w-full border px-3 py-2 rounded border-gray-300"
              disabled={loading}
              placeholder="(optional)"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block mb-1 font-medium">Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* V2Ray Settings */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">V2Ray Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Type *"
              value={v2rayType}
              onChange={setV2rayType}
              options={[
                { value: "vless", label: "VLESS" },
                { value: "vmess", label: "VMESS" },
              ]}
              error={errors.v2rayType}
              disabled={loading}
            />
            <Field
              label="UUID *"
              value={v2rayUuid}
              onChange={setV2rayUuid}
              error={errors.v2rayUuid}
              disabled={loading}
            />
            <Select
              label="Transport *"
              value={v2rayNetwork}
              onChange={setV2rayNetwork}
              options={[
                { value: "ws", label: "WebSocket" },
                { value: "grpc", label: "gRPC" },
                { value: "tcp", label: "TCP" },
              ]}
              error={errors.v2rayNetwork}
              disabled={loading}
            />
            <Toggle label="TLS" checked={v2rayTls} onChange={setV2rayTls} disabled={loading} />
            <Field label="Path" value={v2rayPath} onChange={setV2rayPath} placeholder="/, /link" disabled={loading} />
            <Field label="Host Header" value={v2rayHost} onChange={setV2rayHost} placeholder="(optional) CDN/Host header" disabled={loading} />
            <Field label="SNI" value={v2raySni} onChange={setV2raySni} placeholder="(optional) SNI for TLS" error={errors.v2raySni} disabled={loading} />
            <Field label="Flow" value={v2rayFlow} onChange={setV2rayFlow} placeholder="(optional) e.g. xtls-rprx-vision" disabled={loading} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block mb-1 font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Optional"
            disabled={loading}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <button type="button" onClick={onCancel} className="px-5 py-2 rounded border border-gray-400 text-gray-700 hover:bg-gray-100" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={loading}>
            {loading ? "Saving..." : "Save Server"}
          </button>
        </div>

        {message && (
          <p className={`mt-4 font-medium ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
};

/* ————— Small UI helpers ————— */

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

const Select = ({ label, value, onChange, options, error, disabled }) => (
  <div className="mb-3">
    <label className="block mb-1 font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border rounded px-3 py-2 ${error ? "border-red-500" : "border-gray-300"}`}
      disabled={disabled}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

const Toggle = ({ label, checked, onChange, disabled }) => (
  <div className="mb-3 flex items-center gap-3">
    <span className="font-medium">{label}</span>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition" />
      <span className="ml-3 text-sm text-gray-700">{checked ? "On" : "Off"}</span>
    </label>
  </div>
);

export default AddServer;
