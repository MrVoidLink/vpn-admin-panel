// src/pages/ServerManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { FaServer, FaSyncAlt, FaPlus, FaTrash, FaPen } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// Utilities
const S = (v) => (v == null ? "" : String(v));
const toNum = (v, d = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const isHttpUrl = (s) => /^https?:\/\//i.test(S(s).trim());
const isBase64ish = (s) => /^[A-Za-z0-9+/=]{32,}$/.test(S(s));

export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState(null);
  const [editServer, setEditServer] = useState(null);

  // for details view
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Variant modal (add/edit)
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null); // null = add
  const [variantDraft, setVariantDraft] = useState(defaultVariant("openvpn"));

  const fetchServers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "servers"));
      const serversList = [];
      querySnapshot.forEach((docu) => {
        const data = docu.data() || {};
        serversList.push({
          id: docu.id,
          ...data,
          protocols: Array.isArray(data.protocols) ? data.protocols : [],
          variantsCount:
            typeof data.variantsCount === "number" ? data.variantsCount : 0,
        });
      });
      setServers(serversList);
    } catch (error) {
      console.error("Error fetching servers:", error);
      alert("Failed to fetch servers.");
    }
    setLoading(false);
  };

  const fetchVariants = async (serverId) => {
    setVariantsLoading(true);
    try {
      const snap = await getDocs(collection(db, "servers", serverId, "variants"));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setVariants(list);
    } catch (err) {
      console.error("fetchVariants error:", err);
      alert("Failed to load variants.");
    }
    setVariantsLoading(false);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const visibleServers = useMemo(() => servers, [servers]);

  // Delete server + variants
  const handleDeleteServer = async (serverId) => {
    const confirmDel = window.confirm(
      "Delete this server and ALL its variants?"
    );
    if (!confirmDel) return;

    try {
      // 1) delete variants in batch
      const variantsSnap = await getDocs(
        collection(db, "servers", serverId, "variants")
      );
      const batch = writeBatch(db);
      variantsSnap.forEach((vDoc) => batch.delete(vDoc.ref));
      await batch.commit();

      // 2) delete server doc
      await deleteDoc(doc(db, "servers", serverId));

      // 3) update state
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (selectedServer?.id === serverId) setSelectedServer(null);
      if (editServer?.id === serverId) setEditServer(null);
    } catch (error) {
      alert("Failed to delete server: " + error.message);
    }
  };

  // Update base server fields only
  const handleEditServer = async (updatedServer) => {
    try {
      const ref = doc(db, "servers", updatedServer.id);
      const {
        id,
        protocols,
        variantsCount,
        createdAt,
        updatedAt,
        ...serverData
      } = updatedServer;
      await updateDoc(ref, {
        ...serverData,
        updatedAt: new Date().toISOString(),
      });
      setEditServer(null);
      fetchServers();
      if (selectedServer?.id === updatedServer.id) {
        setSelectedServer((s) => ({ ...s, ...serverData }));
      }
    } catch (error) {
      alert("Failed to update server: " + error.message);
    }
  };

  // Open details (loads variants)
  const openDetails = async (srv) => {
    setSelectedServer(srv);
    setVariants([]);
    await fetchVariants(srv.id);
  };

  // Variant CRUD
  const openAddVariant = (proto = "openvpn") => {
    setEditingVariant(null);
    setVariantDraft(defaultVariant(proto));
    setVariantModalOpen(true);
  };

  const openEditVariant = (variant) => {
    setEditingVariant(variant);
    setVariantDraft({
      protocol: variant.protocol || "openvpn",
      // openvpn
      port: variant.port ?? 1194,
      configFileUrl: variant.configFileUrl || "",
      username: variant.username || "",
      password: variant.password || "",
      // wireguard
      endpointPort: variant.endpointPort ?? 51820,
      publicKey: variant.publicKey || "",
      address: variant.address || "",
      dns: variant.dns || "",
      allowedIps: variant.allowedIps || "",
      persistentKeepalive:
        variant.persistentKeepalive != null ? String(variant.persistentKeepalive) : "",
      mtu: variant.mtu != null ? String(variant.mtu) : "",
      preSharedKey: variant.preSharedKey || "",
    });
    setVariantModalOpen(true);
  };

  const closeVariantModal = () => {
    setVariantModalOpen(false);
    setEditingVariant(null);
  };

  const handleSaveVariant = async () => {
    if (!selectedServer) return;
    const serverId = selectedServer.id;

    // validate draft
    const errs = validateVariant(variantDraft);
    if (errs.length) {
      alert("Please fix:\n- " + errs.join("\n- "));
      return;
    }

    const colRef = collection(db, "servers", serverId, "variants");

    // normalize payload
    const payload = normalizeVariant(variantDraft, selectedServer.ipAddress);

    try {
      if (editingVariant) {
        // update
        await updateDoc(doc(colRef, editingVariant.id), {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // add
        await addDoc(colRef, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        // bump counters on server base (protocols/variantsCount)
        await refreshServerSummary(serverId);
      }
      await fetchVariants(serverId);
      closeVariantModal();
    } catch (err) {
      console.error("save variant error:", err);
      alert("Failed to save variant.");
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!selectedServer) return;
    const ok = window.confirm("Delete this variant?");
    if (!ok) return;
    try {
      await deleteDoc(
        doc(db, "servers", selectedServer.id, "variants", variantId)
      );
      await fetchVariants(selectedServer.id);
      await refreshServerSummary(selectedServer.id);
    } catch (err) {
      console.error("delete variant error:", err);
      alert("Failed to delete variant.");
    }
  };

  // after add/delete variants → recompute summary fields on server
  const refreshServerSummary = async (serverId) => {
    const snap = await getDocs(
      collection(db, "servers", serverId, "variants")
    );
    const list = [];
    snap.forEach((d) => list.push(d.data()));
    const protocols = Array.from(
      new Set(list.map((v) => S(v.protocol).toLowerCase().trim()).filter(Boolean))
    );
    const variantsCount = list.length;

    await updateDoc(doc(db, "servers", serverId), {
      protocols,
      variantsCount,
      updatedAt: new Date().toISOString(),
    });

    // reflect in local state
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId ? { ...s, protocols, variantsCount } : s
      )
    );
    if (selectedServer?.id === serverId) {
      setSelectedServer((s) => (s ? { ...s, protocols, variantsCount } : s));
    }
  };

  return (
    <section className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaServer className="text-blue-600 text-3xl" />
          <div>
            <h1 className="text-2xl font-bold">Server Management</h1>
            <span className="text-gray-500 text-sm">
              Total Servers: <b>{servers.length}</b> | Visible:{" "}
              <b>{visibleServers.length}</b>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <thead className="bg-gray-100 text-sm text-gray-700">
            <tr>
              <th className="p-4 text-left rounded-tl-xl">Name</th>
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
                <td colSpan={9} className="text-center py-8 text-gray-500">
                  No servers to show.
                </td>
              </tr>
            ) : (
              visibleServers.map((srv) => {
                const protocolLabel =
                  Array.isArray(srv.protocols) && srv.protocols.length
                    ? srv.protocols.join(", ")
                    : "-";
                const variantsLabel =
                  typeof srv.variantsCount === "number"
                    ? srv.variantsCount
                    : "-";

                return (
                  <tr key={srv.id} className="border-b last:border-none">
                    <td className="p-4">{srv.serverName || "-"}</td>
                    <td className="p-4">{srv.ipAddress || srv.host || "-"}</td>
                    <td className="p-4">{srv.serverType || "-"}</td>
                    <td className="p-4">{srv.location || "-"}</td>
                    <td className="p-4">{srv.country || "-"}</td>
                    <td className="p-4">{protocolLabel}</td>
                    <td className="p-4">{variantsLabel}</td>
                    <td className="p-4">{srv.pingMs ?? "-"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-100"
                          onClick={() => openDetails(srv)}
                        >
                          View
                        </button>
                        <button
                          className="px-3 py-1 rounded border text-blue-700 hover:bg-blue-50"
                          onClick={() => setEditServer(srv)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 rounded border text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteServer(srv.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details Drawer */}
      {selectedServer && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedServer(null)}>
          <div
            className="absolute right-0 top-0 h-full w-full md:w-[680px] bg-white shadow-xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {selectedServer.serverName} — Variants
              </h2>
              <button
                onClick={() => setSelectedServer(null)}
                className="px-3 py-1 border rounded"
              >
                Close
              </button>
            </div>

            <ServerSummaryCard server={selectedServer} />

            <div className="flex items-center justify-between mt-4">
              <h3 className="font-semibold">Variants</h3>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 border rounded text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                  onClick={() => openAddVariant("openvpn")}
                >
                  <FaPlus /> Add OpenVPN
                </button>
                <button
                  className="px-3 py-2 border rounded text-purple-700 hover:bg-purple-50 flex items-center gap-2"
                  onClick={() => openAddVariant("wireguard")}
                >
                  <FaPlus /> Add WireGuard
                </button>
              </div>
            </div>

            <div className="mt-3">
              {variantsLoading ? (
                <p className="text-sm text-gray-500">Loading variants…</p>
              ) : variants.length === 0 ? (
                <p className="text-sm text-gray-500">No variants yet.</p>
              ) : (
                <ul className="space-y-3">
                  {variants.map((v) => (
                    <li key={v.id} className="border rounded p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium capitalize">{v.protocol}</p>
                          {v.protocol === "openvpn" && (
                            <div className="text-sm text-gray-700 space-y-1">
                              <p>Port: {v.port ?? "-"}</p>
                              {v.configFileUrl && (
                                <p className="break-all">
                                  OVPN: <a href={v.configFileUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">{v.configFileUrl}</a>
                                </p>
                              )}
                              {(v.username || v.password) && (
                                <p>User/Pass: {v.username || "-"} / {v.password ? "•••" : "-"}</p>
                              )}
                            </div>
                          )}
                          {v.protocol === "wireguard" && (
                            <div className="text-sm text-gray-700 space-y-1">
                              <p>Endpoint Port: {v.endpointPort ?? "-"}</p>
                              {v.publicKey && <p className="break-all">Public Key: {v.publicKey}</p>}
                              {v.address && <p>Address: {v.address}</p>}
                              {v.dns && <p>DNS: {v.dns}</p>}
                              {v.allowedIps && <p className="break-all">Allowed IPs: {v.allowedIps}</p>}
                              {v.persistentKeepalive != null && <p>Keepalive: {v.persistentKeepalive}s</p>}
                              {v.mtu != null && <p>MTU: {v.mtu}</p>}
                              {v.preSharedKey && <p className="break-all">PSK: {v.preSharedKey}</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded border text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                            onClick={() => openEditVariant(v)}
                          >
                            <FaPen /> Edit
                          </button>
                          <button
                            className="px-3 py-1 rounded border text-red-700 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => handleDeleteVariant(v.id)}
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Variant Modal */}
          {variantModalOpen && (
            <VariantModal
              draft={variantDraft}
              setDraft={setVariantDraft}
              onClose={closeVariantModal}
              onSave={handleSaveVariant}
              editing={!!editingVariant}
            />
          )}
        </div>
      )}

      {/* Edit Server Modal */}
      {editServer && (
        <EditServerModal
          server={editServer}
          onCancel={() => setEditServer(null)}
          onSave={handleEditServer}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Components

function ServerSummaryCard({ server }) {
  const protocols =
    Array.isArray(server.protocols) && server.protocols.length
      ? server.protocols.join(", ")
      : "-";
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <Info label="Name" value={server.serverName || "-"} />
        <Info label="IP/Host" value={server.ipAddress || server.host || "-"} />
        <Info label="Type" value={server.serverType || "-"} />
        <Info label="Location" value={server.location || "-"} />
        <Info label="Country" value={server.country || "-"} />
        <Info label="Ping" value={server.pingMs ?? "-"} />
        <Info label="Protocols" value={protocols} />
        <Info label="Variants" value={server.variantsCount ?? "-"} />
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium break-all">{String(value)}</span>
    </p>
  );
}

function EditServerModal({ server, onCancel, onSave }) {
  const [form, setForm] = useState({
    id: server.id,
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

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    // basic validation
    if (!form.serverName || !form.ipAddress) {
      alert("Name and IP/Host are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
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
      await onSave({ id: form.id, ...payload });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 mx-auto mt-20"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Edit Server</h3>

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
          <Field
            label="Ping (ms)"
            type="number"
            value={form.pingMs}
            onChange={(v) => change("pingMs", v)}
          />
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

        <div className="flex justify-end gap-2 mt-6">
          <button className="px-4 py-2 border rounded" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantModal({ draft, setDraft, onClose, onSave, editing }) {
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
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 mx-auto mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">
          {editing ? "Edit Variant" : "Add Variant"}
        </h3>

        <div className="mb-3">
          <label className="block mb-1 font-medium">Protocol</label>
          <select
            className="w-full border px-3 py-2 rounded"
            value={draft.protocol}
            onChange={(e) => change("protocol", e.target.value)}
          >
            <option value="openvpn">OpenVPN</option>
            <option value="wireguard">WireGuard</option>
          </select>
        </div>

        {draft.protocol === "openvpn" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Port *"
              type="number"
              value={draft.port}
              onChange={(v) => change("port", v)}
            />
            <Field
              label="Config file URL (optional)"
              value={draft.configFileUrl}
              onChange={(v) => change("configFileUrl", v)}
              placeholder="https://.../server.ovpn"
            />
            <Field
              label="Username (optional)"
              value={draft.username}
              onChange={(v) => change("username", v)}
            />
            <Field
              label="Password (optional)"
              value={draft.password}
              onChange={(v) => change("password", v)}
            />
          </div>
        )}

        {draft.protocol === "wireguard" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Endpoint Port *"
              type="number"
              value={draft.endpointPort}
              onChange={(v) => change("endpointPort", v)}
            />
            <Field
              label="Server Public Key (base64, optional)"
              value={draft.publicKey}
              onChange={(v) => change("publicKey", v)}
            />
            <Field
              label="Client Address (optional)"
              value={draft.address}
              onChange={(v) => change("address", v)}
              placeholder="10.7.0.2/32"
            />
            <Field
              label="DNS (optional)"
              value={draft.dns}
              onChange={(v) => change("dns", v)}
              placeholder="1.1.1.1"
            />
            <Field
              label="Allowed IPs (optional)"
              value={draft.allowedIps}
              onChange={(v) => change("allowedIps", v)}
              placeholder="0.0.0.0/0, ::/0"
            />
            <Field
              label="Persistent Keepalive (sec, optional)"
              value={draft.persistentKeepalive}
              onChange={(v) => change("persistentKeepalive", v)}
              placeholder="25"
            />
            <Field
              label="MTU (optional)"
              value={draft.mtu}
              onChange={(v) => change("mtu", v)}
              placeholder="1420"
            />
            <Field
              label="Pre-shared Key (optional)"
              value={draft.preSharedKey}
              onChange={(v) => change("preSharedKey", v)}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="px-4 py-2 border rounded" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
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

// ─────────────────────────────────────────────────────────────
// Variant helpers

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
      // openvpn placeholders (unused)
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
    // allowedIps/address/dns/psk اختیاری هستن—validate ساده نگه می‌داریم
  }
  return errs;
}

function normalizeVariant(v, ipAddress) {
  const out = {
    protocol: v.protocol,
    meta: { host: ipAddress },
  };
  if (v.protocol === "openvpn") {
    out.port = toNum(v.port, 1194);
    if (v.configFileUrl) out.configFileUrl = S(v.configFileUrl).trim();
    if (v.username) out.username = S(v.username).trim();
    if (v.password) out.password = S(v.password).trim();
  }
  if (v.protocol === "wireguard") {
    out.endpointPort = toNum(v.endpointPort, 51820);
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
