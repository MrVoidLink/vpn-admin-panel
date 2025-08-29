import React, { useMemo, useState } from "react";
import axios from "axios";

const AddServer = ({ onCancel }) => {
  // ————— Common fields
  const [serverName, setServerName] = useState("");
  const [ipAddress, setIpAddress]   = useState("");
  const [port, setPort]             = useState(1194); // OpenVPN default
  const [serverType, setServerType] = useState("free");
  const [maxConnections, setMaxConnections] = useState(10);
  const [location, setLocation]     = useState("");
  const [country, setCountry]       = useState("");
  const [status, setStatus]         = useState("active");
  const [description, setDescription] = useState("");
  const [pingMs, setPingMs]         = useState("");

  // ————— OpenVPN fields
  const [configFileUrl, setConfigFileUrl] = useState("");
  const [ovpnUsername, setOvpnUsername]   = useState("");
  const [ovpnPassword, setOvpnPassword]   = useState("");

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const ipRegex = useMemo(
    () => /^(\\d{1,3}\\.){3}\\d{1,3}$|^([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}$/,
    []
  );

  const validate = () => {
    const e = {};
    if (!serverName) e.serverName = "Required";
    if (!ipAddress || !ipRegex.test(ipAddress)) e.ipAddress = "Valid IP/host required";
    if (!port || port < 1 || port > 65535) e.port = "Invalid port";
    if (!location) e.location = "Required";
    if (!country) e.country = "Required";
    if (!status) e.status = "Required";
    if (pingMs && (isNaN(Number(pingMs)) || Number(pingMs) < 0)) e.pingMs = "Invalid";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        serverName, ipAddress, port,
        serverType, maxConnections,
        location, country, status,
        description, pingMs: pingMs === "" ? undefined : Number(pingMs),
        protocol: "openvpn",
        configFileUrl,
        ovpnUsername,
        ovpnPassword,
      };

      const { data } = await axios.post("/api/add-server", payload);
      if (data?.ok) {
        setMessage({ type: "success", text: "Server added." });
      } else {
        throw new Error(data?.message || "Unknown error");
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold mb-2">Add OpenVPN Server</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name *" value={serverName} onChange={setServerName} error={errors.serverName} disabled={loading} />
        <Field label="IP / Host *" value={ipAddress} onChange={setIpAddress} error={errors.ipAddress} disabled={loading} />
        <Field label="Port *" type="number" value={port} onChange={(v)=>setPort(Number(v))} error={errors.port} disabled={loading} />
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
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold mb-3">OpenVPN Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Config file URL" value={configFileUrl} onChange={setConfigFileUrl} placeholder="https://.../server.ovpn" disabled={loading} />
          <Field label="Username (optional)" value={ovpnUsername} onChange={setOvpnUsername} disabled={loading} />
          <Field label="Password (optional)" value={ovpnPassword} onChange={setOvpnPassword} disabled={loading} />
        </div>
        <p className="text-xs text-gray-500 mt-2">You can leave username/password empty for cert-based configs.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field label="Ping (ms, optional)" value={pingMs} onChange={setPingMs} placeholder="e.g. 120" disabled={loading} />
        <div>
          <label className="block mb-1 font-medium">Description</label>
          <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} className="w-full border px-3 py-2 rounded" disabled={loading} />
        </div>
      </div>

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
