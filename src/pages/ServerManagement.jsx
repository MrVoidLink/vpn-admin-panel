import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { FaServer, FaSyncAlt } from "react-icons/fa";
import ServerDetailsCard from "../components/Server/ServerDetailsCard.jsx";
import ServerEditForm from "../components/Server/ServerEditForm.jsx";

export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState(null);
  const [editServer, setEditServer] = useState(null);

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

  const visibleServers = useMemo(() => servers, [servers]);

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
                return (
                  <tr key={srv.id} className="border-b last:border-none">
                    <td className="p-4">{srv.serverName || "-"}</td>
                    <td className="p-4">{srv.ipAddress || "-"}</td>
                    <td className="p-4">{srv.port || "-"}</td>
                    <td className="p-4">{srv.protocol || "-"}</td>
                    <td className="p-4">{srv.serverType || "-"}</td>
                    <td className="p-4">{srv.location || "-"}</td>
                    <td className="p-4">{srv.country || "-"}</td>
                    <td className="p-4">{srv.pingMs ?? "-"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-100"
                          onClick={() => setSelectedServer(srv)}
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
