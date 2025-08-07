import React, { useState } from "react";

export default function ServerEditForm({ server, onSave, onCancel }) {
  const [form, setForm] = useState({
    serverName: server.serverName || "",
    ipAddress: server.ipAddress || "",
    port: server.port || "",
    protocol: server.protocol || "",
    serverType: server.serverType || "",
    maxConnections: server.maxConnections || "",
    location: server.location || "",
    country: server.country || "",
    configFileUrl: server.configFileUrl || "",
    status: server.status || "",
    description: server.description || "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...server, ...form });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 p-6 bg-white rounded-2xl shadow-lg border grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Server Name</label>
        <input name="serverName" value={form.serverName} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">IP Address</label>
        <input name="ipAddress" value={form.ipAddress} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Port</label>
        <input name="port" value={form.port} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Protocol</label>
        <input name="protocol" value={form.protocol} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Server Type</label>
        <input name="serverType" value={form.serverType} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Max Connections</label>
        <input name="maxConnections" value={form.maxConnections} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Location</label>
        <input name="location" value={form.location} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Country</label>
        <input name="country" value={form.country} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Config File URL</label>
        <input name="configFileUrl" value={form.configFileUrl} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="text-gray-500 text-xs mb-1 block">Status</label>
        <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded p-2">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="text-gray-500 text-xs mb-1 block">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
      </div>
    </form>
  );
}
