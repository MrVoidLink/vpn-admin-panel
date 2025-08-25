import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { FaServer, FaSyncAlt, FaEye, FaEdit, FaTrash } from "react-icons/fa";
import ServerDetailsCard from "../components/Server/ServerDetailsCard.jsx";
import ServerEditForm from "../components/Server/ServerEditForm.jsx";

const isV2 = (p) => ["v2ray","vmess","vless"].includes(String(p||"").toLowerCase());

export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState(null);
  const [editServer, setEditServer] = useState(null);

  // ✅ فیلتر نمایشی – بدون حذف داده
  const [showOnlyV2Ray, setShowOnlyV2Ray] = useState(true);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "servers"));
      const serversList = [];
      querySnapshot.forEach((docu) => {
        serversList.push({ id: docu.id, ...docu.data() });
      });
      setServers(serversList);
    } catch (error) {
      console.error("Error fetching servers:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const visibleServers = useMemo(() => {
    if (!showOnlyV2Ray) return servers;
    return servers.filter((s) => isV2(s.protocol));
  }, [servers, showOnlyV2Ray]);

  const handleDeleteServer = async (serverId) => {
    const confirm = window.confirm("Are you sure you want to delete this server?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, "servers", serverId));
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (selectedServer?.id === serverId) setSelectedServer(null);
      if (editServer?.id === serverId) setEditServer(null);
    } catch (error) {
      alert("Failed to delete server: " + error.message);
    }
  };

  const handleEditServer = async (updatedServer) => {
    try {
      const ref = doc(db, "servers", updatedServer.id);
      const { id, ...serverData } = updatedServer;
      await updateDoc(ref, serverData);
      setEditServer(null);
      fetchServers();
    } catch (error) {
      alert("Failed to update server: " + error.message);
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
              Total Servers: <b>{servers.length}</b> | Visible: <b>{visibleServers.length}</b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* فیلتر نمایشی فقط V2Ray */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyV2Ray}
              onChange={(e) => setShowOnlyV2Ray(e.target.checked)}
            />
            Show only V2Ray
          </label>

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
              <th className="p-4 text-left">IP</th>
              <th className="p-4 text-left">Port</th>
              <th className="p-4 text-left">Protocol</th>
              <th className="p-4 text-left">Type</th>
              <th className="p-4 text-left">Location</th>
              <th className="p-4 text-left">Country</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Config</th>
              <th className="p-4 text-left rounded-tr-xl">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleServers.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400">
                  No servers found.
                </td>
              </tr>
            ) : (
              visibleServers.map((srv) => {
                const proto = String(srv.protocol || "").toLowerCase();
                const v2Link = `/api/server-config?id=${srv.id}`;
                const ovpnLink = srv.configFileUrl; // سازگاری با قدیمی‌ها

                return (
                  <tr key={srv.id} className="border-t hover:bg-blue-50 transition">
                    <td className="p-4 font-medium flex items-center gap-2">
                      <FaServer className="text-gray-400" /> {srv.serverName}
                    </td>
                    <td className="p-4">{srv.ipAddress}</td>
                    <td className="p-4">{srv.port}</td>
                    <td className="p-4">{srv.protocol}</td>
                    <td className="p-4 capitalize">{srv.serverType}</td>
                    <td className="p-4">{srv.location}</td>
                    <td className="p-4">{srv.country}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          srv.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {srv.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {isV2(proto) ? (
                        <a
                          href={v2Link}
                          className="text-blue-600 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View V2Ray config (API)"
                        >
                          View
                        </a>
                      ) : ovpnLink ? (
                        <a
                          href={ovpnLink}
                          className="text-blue-600 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Legacy config file"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button
                        className="text-blue-600 hover:bg-blue-100 rounded p-2"
                        title="View"
                        onClick={() => { setSelectedServer(srv); setEditServer(null); }}
                      >
                        <FaEye />
                      </button>
                      <button
                        className="text-yellow-600 hover:bg-yellow-100 rounded p-2"
                        title="Edit"
                        onClick={() => { setEditServer(srv); setSelectedServer(null); }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="text-red-600 hover:bg-red-100 rounded p-2"
                        title="Delete"
                        onClick={() => handleDeleteServer(srv.id)}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details / Edit */}
      {selectedServer && (
        <ServerDetailsCard server={selectedServer} onClose={() => setSelectedServer(null)} />
      )}
      {editServer && (
        <ServerEditForm server={editServer} onSave={handleEditServer} onCancel={() => setEditServer(null)} />
      )}
    </section>
  );
}
