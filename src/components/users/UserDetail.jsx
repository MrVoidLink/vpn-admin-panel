// src/components/users/UserDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import firebaseApp from "../../firebase/firebaseConfig";

// helpers
const IS_PROD = import.meta.env.MODE === "production";

const isTimestamp = (v) => v && typeof v === "object" && ("seconds" in v || "toDate" in v);
const toDate = (v) => {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (isTimestamp(v)) return typeof v.toDate === "function" ? v.toDate() : new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    return new Date(v);
  } catch { return null; }
};
const fmtDate = (v) => { const d = toDate(v); return d ? d.toLocaleString() : "—"; };
const diffDays = (f) => { const d = toDate(f); if (!d) return null; const ms = d - new Date(); return Math.ceil(ms / 86400000); };
const fmtBytes = (n) => { const v = Number(n||0); if (Number.isNaN(v)) return "0 B"; if (v<1024) return `${v} B`; const u=["KB","MB","GB","TB"]; let i=-1,val=v; do{val/=1024;i++;}while(val>=1024&&i<u.length-1); return `${val.toFixed(1)} ${u[i]}`; };
const safe = (v) => (v === undefined || v === null || v === "" ? "—" : v);
const daysLeft = (expiresAt) => {
  const d = toDate(expiresAt);
  if (!d) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff;
};
const isExpired = (expiresAt) => {
  const d = toDate(expiresAt);
  return d ? d.getTime() <= Date.now() : false;
};

// هدرهای ادمین: بدون کلید/اتورایز
const buildAdminHeaders = async () => ({
  "Content-Type": "application/json"
});

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // کاربر
        const userRef = doc(db, "users", id);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) { setUser(null); setDevices([]); setCode(null); return; }
        const data = { uid: userSnap.id, ...userSnap.data() };
        setUser(data);

        // دستگاه‌ها
        const devRef = collection(db, "users", id, "devices");
        const devSnap = await getDocs(devRef);
        const devs = devSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        devs.sort((a,b) => ((toDate(b?.lastSeenAt)?.getTime()||0) - (toDate(a?.lastSeenAt)?.getTime()||0)));
        setDevices(devs);

        // اگر کد فعالی دارد، سند کد را هم بخوان
        if (data?.tokenId) {
          const codeRef = doc(db, "codes", data.tokenId);
          const codeSnap = await getDoc(codeRef);
          setCode(codeSnap.exists() ? { id: codeSnap.id, ...codeSnap.data() } : null);
        } else {
          setCode(null);
        }
      } catch (e) {
        console.error("خطا در دریافت کاربر/دستگاه‌ها:", e);
        setUser(null); setDevices([]); setCode(null);
      } finally { setLoading(false); }
    };
    fetchAll();
  }, [id, db]);

  if (loading) return <div className="p-6">در حال بارگذاری...</div>;
  if (!user) return <div className="p-6 text-red-600">کاربر پیدا نشد.</div>;

  const expiresAt = user?.subscription?.expiresAt;
  const remaining = diffDays(expiresAt);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-md rounded-xl p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">User Details</h2>
            <p className="text-gray-500 text-sm break-all">UID: {user.uid}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* دکمه‌های تست فقط در Dev */}
            {!IS_PROD && user && (
              <>
                <button
                  onClick={async () => {
                    const codeId = prompt("Enter codeId to apply:");
                    if (!codeId) return;
                    try {
                      const r = await fetch(`/api/apply-token`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid: user.uid, codeId }),
                      });
                      let data=null; try{ data=await r.json(); }catch(_){}
                      if (!r.ok) return alert(`Failed: ${data?.error || r.status}`);
                      alert("Applied!"); window.location.reload();
                    } catch (e) { console.error(e); alert("Request failed"); }
                  }}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >Apply Token (DEV)</button>

                <button
                  onClick={async () => {
                    if (!user.tokenId) return alert("اول Apply Token انجام بده؛ tokenId نداریم.");
                    const deviceId = prompt("Enter deviceId to CLAIM:");
                    if (!deviceId) return;
                    const platform = user.platform || "android";
                    const model = user.deviceModel || "";
                    const appVersion = user.appVersion || "";
                    try {
                      const r = await fetch("/api/claim-device", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid: user.uid, codeId: user.tokenId, deviceId, deviceInfo: { platform, model, appVersion } }),
                      });
                      let data=null; try{ data=await r.json(); }catch(_){}
                      if (!r.ok) return alert(`CLAIM failed: ${data?.error || r.status}`);
                      alert(`CLAIM ok (${data.activeDevices}/${data.maxDevices} active)`);
                    } catch (e) { console.error(e); alert("CLAIM request failed"); }
                  }}
                  className="text-sm bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                >Claim Device (DEV)</button>

                <button
                  onClick={async () => {
                    if (!user.tokenId) return alert("اول Apply Token انجام بده؛ tokenId نداریم.");
                    const deviceId = prompt("Enter deviceId to RELEASE:");
                    if (!deviceId) return;
                    try {
                      const r = await fetch("/api/release-device", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid: user.uid, codeId: user.tokenId, deviceId }),
                      });
                      let data=null; try{ data=await r.json(); }catch(_){}
                      if (!r.ok) return alert(`RELEASE failed: ${data?.error || r.status}`);
                      alert(`RELEASE ok (${data.activeDevices}/${data.maxDevices} active)`);
                    } catch (e) { console.error(e); alert("RELEASE request failed"); }
                  }}
                  className="text-sm bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700"
                >Release Device (DEV)</button>
              </>
            )}

            {/* دکمه‌های ادمین: بدون کلید */}
            <button
              onClick={async () => {
                try {
                  const headers = await buildAdminHeaders();
                  const r = await fetch("/api/admin-reset-user", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ uid: user.uid, alsoRemoveRedemption: true }),
                  });
                  let data=null; try{ data=await r.json(); }catch(_){}
                  if (!r.ok) return alert(`RESET failed: ${data?.error || r.status}`);
                  alert(`User reset OK (cleared ${data?.clearedDevices ?? 0} devices)`);
                  window.location.reload();
                } catch (e) {
                  console.error(e); alert("RESET request failed");
                }
              }}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >Reset User</button>

            <button
              onClick={async () => {
                if (!user.tokenId) return alert("tokenId نداریم (اول Apply Token)!");
                try {
                  const headers = await buildAdminHeaders();
                  const r = await fetch("/api/admin-clear-code", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ codeId: user.tokenId }),
                  });
                  let data=null; try{ data=await r.json(); }catch(_){}
                  if (!r.ok) return alert(`CLEAR failed: ${data?.error || r.status}`);
                  alert(`Code cleared OK (devices affected: ${data?.clearedDevices ?? 0})`);
                } catch (e) {
                  console.error(e); alert("CLEAR request failed");
                }
              }}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
            >Clear Code</button>

            <button
              onClick={() => navigate("/admin/users")}
              className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
            >← بازگشت به لیست کاربران</button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white shadow-md rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
          <div><span className="font-semibold">Plan:</span> {safe(user?.planType)}</div>
          <div><span className="font-semibold">Language:</span> {safe(user?.language)}</div>
          <div>
            <span className="font-semibold">Status:</span>{" "}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              user?.status === "active" ? "bg-green-100 text-green-700"
              : user?.status === "suspended" ? "bg-red-100 text-red-700"
              : "bg-gray-200 text-gray-600"}`}>
              {safe(user?.status)}
            </span>
          </div>
          <div><span className="font-semibold">Created:</span> {fmtDate(user?.createdAt)}</div>
          <div><span className="font-semibold">Last Seen:</span> {fmtDate(user?.lastSeenAt)}</div>
          <div><span className="font-semibold">App Version:</span> {safe(user?.appVersion)}</div>
          <div><span className="font-semibold">Platform / Model:</span> {`${safe(user?.platform)} / ${safe(user?.deviceModel)}`}</div>
          <div><span className="font-semibold">Default Server:</span> <span className="break-all">{safe(user?.defaultServerId)}</span></div>
          <div><span className="font-semibold">Token ID:</span> <span className="break-all">{safe(user?.tokenId)}</span></div>
          <div><span className="font-semibold">Subscription Source:</span> {safe(user?.subscription?.source)}</div>
          <div><span className="font-semibold">Code ID:</span> <span className="break-all">{safe(user?.subscription?.codeId)}</span></div>
          <div>
            <span className="font-semibold">Expires / Days:</span>{" "}
            {fmtDate(expiresAt)}{" "}
            <span className={`ml-2 ${remaining <= 0 ? "text-red-600" : "text-gray-500"}`}>
              {remaining === null ? "—" : `(${remaining} days)`}
            </span>
          </div>
          <div><span className="font-semibold">Favorites:</span> {Array.isArray(user?.favorites) ? user.favorites.length : 0}</div>
          <div><span className="font-semibold">Notes:</span> {safe(user?.notes)}</div>
          <div><span className="font-semibold">Sessions:</span> {(user?.stats?.totalSessions ?? 0).toLocaleString()}</div>
          <div><span className="font-semibold">Usage:</span> {fmtBytes(user?.stats?.totalBytes ?? 0)}</div>
          <div><span className="font-semibold">Last Server:</span> <span className="break-all">{safe(user?.stats?.lastServerId)}</span></div>
        </div>

        {/* Subscription / Code Info (v2) */}
        {user?.tokenId && (
          <div className="bg-white shadow-md rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Subscription (Code)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium">Code ID:</span> <span className="break-all">{user.tokenId}</span></div>
              <div><span className="font-medium">Type:</span> {code?.type || "—"}</div>
              <div><span className="font-medium">Valid For:</span> {code?.validForDays ?? "—"} days</div>

              <div><span className="font-medium">Max Devices:</span> {code?.maxDevices ?? "—"}</div>
              <div><span className="font-medium">Active Devices:</span> {code?.activeDevices ?? 0}</div>
              <div>
                <span className="font-medium">Capacity:</span>{" "}
                {(code?.activeDevices ?? 0)}/{code?.maxDevices ?? "—"}
              </div>

              <div><span className="font-medium">Activated At:</span> {fmtDate(code?.activatedAt)}</div>
              <div><span className="font-medium">Expires At:</span> {fmtDate(code?.expiresAt)}</div>
              <div><span className="font-medium">Days Left:</span> {daysLeft(code?.expiresAt) ?? "—"}</div>
            </div>

            {/* Status badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isExpired(code?.expiresAt) ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Expired</span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span>
              )}
              {(code?.activeDevices ?? 0) >= (code?.maxDevices ?? Infinity) ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Capacity Full</span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                  {Math.max(0, (code?.maxDevices ?? 0) - (code?.activeDevices ?? 0))} slot(s) left
                </span>
              )}
            </div>
          </div>
        )}

        {/* Devices */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Devices</h3>
            <span className="text-sm text-gray-500">{devices.length} device(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-gray-800">
              <thead className="bg-gray-100 text-left uppercase text-xs text-gray-600">
                <tr>
                  <th className="px-5 py-3">Device ID</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Model / Brand</th>
                  <th className="px-5 py-3">SDK</th>
                  <th className="px-5 py-3">App</th>
                  <th className="px-5 py-3">Registered</th>
                  <th className="px-5 py-3">Last Seen</th>
                  <th className="px-5 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => {
                  const activeFlag = (typeof d.isActive === "boolean") ? d.isActive : !!d.active;
                  return (
                    <tr key={d.id} className={`hover:bg-gray-50 border-b ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="px-5 py-3"><span className="break-all">{d.deviceId || d.id}</span></td>
                      <td className="px-5 py-3">{safe(d.platform)}</td>
                      <td className="px-5 py-3">{`${safe(d.model)}${d.brand ? " / " + d.brand : ""}`}</td>
                      <td className="px-5 py-3">{safe(d.sdkInt)}</td>
                      <td className="px-5 py-3">{safe(d.appVersion)}</td>
                      <td className="px-5 py-3">{fmtDate(d.registeredAt || d.addedAt)}</td>
                      <td className="px-5 py-3">{fmtDate(d.lastSeenAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${activeFlag ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {activeFlag ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-center text-gray-500">دستگاهی ثبت نشده است.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserDetail;
