import React, { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { FaServer, FaSyncAlt, FaEye, FaEdit, FaTrash } from "react-icons/fa";
import ServerDetailsCard from "../components/Server/ServerDetailsCard.jsx";
import ServerEditForm from "../components/Server/ServerEditForm.jsx";

export default function ServerManagement() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState(null);
  const [editServer, setEditServer] = useState(null);

  // گرفتن سرورها از دیتابیس
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

  // حذف سرور
  const handleDeleteServer = async (serverId) => {
    const confirm = window.confirm("Are you sure you want to delete this server?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, "servers", serverId));
      setServers(servers.filter((s) => s.id !== serverId));
      // اگر سرور حذف‌شده انتخاب شده بود، کارت رو هم ببند
      if (selectedServer && selectedServer.id === serverId) setSelectedServer(null);
      if (editServer && editServer.id === serverId) setEditServer(null);
    } catch (error) {
      alert("Failed to delete server: " + error.message);
    }
  };

  // ویرایش سرور
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FaServer className="text-blue-600 text-3xl" />
          <div>
            <h1 className="text-2xl font-bold">Server Management</h1>
            <span className="text-gray-500 text-sm">
              Total Servers: <b>{servers.length}</b>
            </span>
          </div>
        </div>
        <button
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 active:scale-95 transition-all"
          onClick={fetchServers}
          disabled={loading}
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-2xl shadow-xl border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-4 text-left rounded-tl-2xl">Name</th>
              <th className="p-4 text-left">IP</th>
              <th className="p-4 text-left">Port</th>
              <th className="p-4 text-left">Protocol</th>
              <th className="p-4 text-left">Type</th>
              <th className="p-4 text-left">Location</th>
              <th className="p-4 text-left">Country</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Config</th>
              <th className="p-4 text-left rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400">
                  No servers found.
                </td>
              </tr>
            ) : (
              servers.map((srv) => (
                <tr
                  key={srv.id}
                  className="border-t hover:bg-blue-50 transition-all"
                >
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
                      className={`px-2 py-1 rounded-full text-xs font-bold
                        ${srv.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {srv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {srv.configFileUrl ? (
                      <a
                        href={srv.configFileUrl}
                        className="text-blue-600 underline"
                        target="_blank"
                        rel="noopener noreferrer"
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
                      onClick={() => {
                        setSelectedServer(srv);
                        setEditServer(null);
                      }}
                    >
                      <FaEye />
                    </button>
                    <button
                      className="text-yellow-600 hover:bg-yellow-100 rounded p-2"
                      title="Edit"
                      onClick={() => {
                        setEditServer(srv);
                        setSelectedServer(null);
                      }}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نمایش کارت جزییات یا فرم ویرایش */}
      {selectedServer && (
        <ServerDetailsCard
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
        />
      )}
      {editServer && (
        <ServerEditForm
          server={editServer}
          onSave={handleEditServer}
          onCancel={() => setEditServer(null)}
        />
      )}
    </div>
  );
}
