import { FaServer } from "react-icons/fa";

export default function ServerDetailsCard({ server, onClose }) {
  if (!server) return null;

  return (
    <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <FaServer className="text-blue-500 text-2xl" />
          <h2 className="text-xl font-bold">Server Details</h2>
          <span className="ml-2 text-gray-400">({server.serverName})</span>
        </div>
        <button
          className="text-gray-400 hover:text-red-500 text-xl"
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <Info label="IP Address" value={server.ipAddress} />
        <Info label="Port" value={server.port} />
        <Info label="Protocol" value={server.protocol} />
        <Info label="Type" value={server.serverType} />
        <Info label="Location" value={server.location} />
        <Info label="Country" value={server.country} />
        <Info label="Status" value={server.status} />
        <Info
          label="Config URL"
          value={
            server.configFileUrl ? (
              <a
                href={server.configFileUrl}
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {server.configFileUrl}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )
          }
        />
        <Info label="Description" value={server.description || "-"} />
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
