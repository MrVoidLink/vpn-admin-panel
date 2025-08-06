import React, { useState } from "react";
import axios from "axios";

const AddServer = ({ onCancel }) => {
  const [serverName, setServerName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(1194);
  const [protocol, setProtocol] = useState("OpenVPN");
  const [serverType, setServerType] = useState("free");
  const [maxConnections, setMaxConnections] = useState(10);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("active");
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const validate = () => {
    const newErrors = {};
    if (!serverName.trim()) newErrors.serverName = "Server name is required.";
    if (!ipAddress.trim()) newErrors.ipAddress = "IP Address is required.";
    const ipRegex = /^(?!0)(?!.*\.$)((1?\d{1,2}|2[0-4]\d|25[0-5])(\.|$)){4}$/;
    if (ipAddress && !ipRegex.test(ipAddress)) newErrors.ipAddress = "Invalid IP address format.";
    if (!port || port <= 0 || port > 65535) newErrors.port = "Port must be between 1 and 65535.";
    if (!location.trim()) newErrors.location = "Location is required.";
    if (!maxConnections || maxConnections <= 0) newErrors.maxConnections = "Max connections must be positive.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage(null);

    const serverData = {
      serverName,
      ipAddress,
      port,
      protocol,
      serverType,
      maxConnections,
      location,
      status,
      description,
    };

    try {
      const res = await axios.post("/api/add-server", serverData);
      setMessage({ type: "success", text: res.data.message });
      setServerName("");
      setIpAddress("");
      setPort(1194);
      setProtocol("OpenVPN");
      setServerType("free");
      setMaxConnections(10);
      setLocation("");
      setStatus("active");
      setDescription("");
      setErrors({});
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to add server.",
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
        <h1 className="text-2xl font-bold mb-6">Add New Server</h1>

        {/* Server Name */}
        <div>
          <label className="block mb-1 font-medium">Server Name *</label>
          <input
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className={`w-full border px-3 py-2 rounded ${
              errors.serverName ? "border-red-500" : "border-gray-300"
            }`}
            disabled={loading}
          />
          {errors.serverName && <p className="text-red-500 text-sm mt-1">{errors.serverName}</p>}
        </div>

        {/* IP Address */}
        <div>
          <label className="block mb-1 font-medium">IP Address *</label>
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className={`w-full border px-3 py-2 rounded ${
              errors.ipAddress ? "border-red-500" : "border-gray-300"
            }`}
            disabled={loading}
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
            className={`w-full border px-3 py-2 rounded ${
              errors.port ? "border-red-500" : "border-gray-300"
            }`}
            disabled={loading}
          />
          {errors.port && <p className="text-red-500 text-sm mt-1">{errors.port}</p>}
        </div>

        {/* Protocol */}
        <div>
          <label className="block mb-1 font-medium">Protocol *</label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            disabled={loading}
          >
            <option>OpenVPN</option>
            <option>WireGuard</option>
            <option>L2TP</option>
            <option>PPTP</option>
          </select>
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
            className={`w-full border px-3 py-2 rounded ${
              errors.maxConnections ? "border-red-500" : "border-gray-300"
            }`}
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
            className={`w-full border px-3 py-2 rounded ${
              errors.location ? "border-red-500" : "border-gray-300"
            }`}
            disabled={loading}
          />
          {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
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
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded border border-gray-400 text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Server"}
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 font-medium ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
};

export default AddServer;
