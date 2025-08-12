// src/components/users/UserTable.jsx
import React from "react";
import { Link } from "react-router-dom";

// Helpers
const isTimestamp = (v) =>
  v && typeof v === "object" && ("seconds" in v || "toDate" in v);

const toDate = (v) => {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (isTimestamp(v)) {
      return typeof v.toDate === "function"
        ? v.toDate()
        : new Date(v.seconds * 1000);
    }
    if (typeof v === "number") return new Date(v);
    return new Date(v);
  } catch {
    return null;
  }
};

const fmtDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleString() : "—";
};

const diffDays = (future) => {
  const d = toDate(future);
  if (!d) return null;
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const fmtBytes = (n) => {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return "0 B";
  if (v < 1024) return `${v} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let val = v;
  do {
    val /= 1024;
    i++;
  } while (val >= 1024 && i < units.length - 1);
  return `${val.toFixed(1)} ${units[i]}`;
};

const safe = (v) => (v === undefined || v === null || v === "" ? "—" : v);

// کوتاه‌سازی شناسه‌ها/رشته‌های طولانی برای جدول
const shorten = (s = "", head = 6, tail = 6) =>
  !s ? "—" : s.length <= head + tail + 3 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

const UserTable = ({ users }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-md mt-4">
      <table className="min-w-full table-fixed text-sm text-gray-800">
        <thead className="bg-gray-100 text-left uppercase text-xs text-gray-600">
          <tr>
            <th className="px-5 py-3 w-48">UID</th>
            <th className="px-5 py-3 w-20">Plan</th>
            <th className="px-5 py-3 w-40">Expires / Days</th>
            <th className="px-5 py-3 w-16">Lang</th>
            <th className="px-5 py-3 w-24">Status</th>
            <th className="px-5 py-3 w-40">Last Seen</th>
            <th className="px-5 py-3 w-40">Created</th>
            <th className="px-5 py-3 w-20">App</th>
            <th className="px-5 py-3 w-44">Platform / Model</th>
            <th className="px-5 py-3 w-20">Sessions</th>
            <th className="px-5 py-3 w-24">Usage</th>
            <th className="px-5 py-3 w-44">tokenId</th>
            <th className="px-5 py-3 w-28">Source</th>
            <th className="px-5 py-3 w-44">codeId</th>
            <th className="px-5 py-3 w-16">Favs</th>
            <th className="px-5 py-3 w-44">Default Server</th>
            <th className="px-5 py-3 w-20">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const expiresAt = u?.subscription?.expiresAt;
            const remaining = diffDays(expiresAt);
            const app = safe(u?.appVersion);
            const plat = safe(u?.platform);
            const model = safe(u?.deviceModel);
            const sessions = u?.stats?.totalSessions ?? 0;
            const bytes = u?.stats?.totalBytes ?? 0;
            const favs = Array.isArray(u?.favorites) ? u.favorites.length : 0;
            const codeId = u?.subscription?.codeId || "";
            const source = u?.subscription?.source || "—";

            return (
              <tr
                key={u.uid}
                className={`hover:bg-gray-50 border-b ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <td className="px-5 py-4 whitespace-nowrap">
                  <Link
                    to={`/admin/users/${u.uid}`}
                    title={u.uid}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    {shorten(u.uid)}
                  </Link>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">{safe(u?.planType)}</td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span>{fmtDate(expiresAt)}</span>
                    <span
                      className={`text-xs ${
                        remaining !== null && remaining <= 0
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {remaining === null ? "—" : `${remaining} days`}
                    </span>
                  </div>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">{safe(u?.language)}</td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      u?.status === "active"
                        ? "bg-green-100 text-green-700"
                        : u?.status === "suspended"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {safe(u?.status)}
                  </span>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">{fmtDate(u?.lastSeenAt)}</td>
                <td className="px-5 py-4 whitespace-nowrap">{fmtDate(u?.createdAt)}</td>
                <td className="px-5 py-4 whitespace-nowrap">{app}</td>
                <td className="px-5 py-4 whitespace-nowrap">{`${plat} / ${model}`}</td>
                <td className="px-5 py-4 whitespace-nowrap">{sessions.toLocaleString()}</td>
                <td className="px-5 py-4 whitespace-nowrap">{fmtBytes(bytes)}</td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <span title={u?.tokenId || ""}>{shorten(u?.tokenId || "")}</span>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">{source}</td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <span title={codeId}>{shorten(codeId)}</span>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">{favs}</td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <span title={u?.defaultServerId || ""}>
                    {shorten(u?.defaultServerId || "")}
                  </span>
                </td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <Link
                    to={`/admin/users/${u.uid}`}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={17} className="px-5 py-6 text-center text-gray-500">
                کاربری پیدا نشد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
