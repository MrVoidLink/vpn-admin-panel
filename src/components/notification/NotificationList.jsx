import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, startAfter } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const PAGE_SIZE = 10;

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [pageStack, setPageStack] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const fetchNotifications = async (direction = "first") => {
    setLoading(true);

    let q;
    if (direction === "next" && lastDoc) {
      q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );
    }

    const snapshot = await getDocs(q);
    const notis = [];
    snapshot.forEach((doc) => notis.push({ id: doc.id, ...doc.data() }));

    setNotifications(notis);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    setHasNext(snapshot.docs.length === PAGE_SIZE);

    if (direction === "next") setPageStack([...pageStack, snapshot.docs[0]]);
    if (direction === "first") setPageStack([snapshot.docs[0]]);

    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Notification History</h2>
      {loading ? (
        <div className="text-center py-8 text-gray-500 font-medium">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-400 text-center py-8 italic">No notifications found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm table-auto border-collapse border border-gray-200 rounded-md">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 rounded-tl-md">Title</th>
                  <th className="border border-gray-300 px-4 py-2">Message</th>
                  <th className="border border-gray-300 px-4 py-2">Created At</th>
                  <th className="border border-gray-300 px-4 py-2">Schedule At</th>
                  <th className="border border-gray-300 px-4 py-2">Priority</th>
                  <th className="border border-gray-300 px-4 py-2">Type</th>
                  <th className="border border-gray-300 px-4 py-2 rounded-tr-md">Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr
                    key={n.id}
                    className="border border-gray-200 hover:bg-blue-50 transition-colors duration-200"
                  >
                    <td className="border border-gray-300 px-3 py-2 font-semibold">{n.title}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-normal max-w-xs break-words">{n.body}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-nowrap text-center">
                      {n.createdAt?.toDate
                        ? n.createdAt.toDate().toLocaleString()
                        : "-"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-nowrap text-center">
                      {n.scheduleAt?.toDate
                        ? n.scheduleAt.toDate().toLocaleString()
                        : "-"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 capitalize text-center">
                      {n.priority || "-"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 capitalize text-center">
                      {n.type || "-"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold
                          ${
                            n.status === "sent"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }
                        `}
                      >
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <button
              className="bg-gray-200 text-gray-600 px-4 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition"
              onClick={() => {
                if (pageStack.length > 1) {
                  setPageStack(pageStack.slice(0, -1));
                  fetchNotifications("prev");
                }
              }}
              disabled={pageStack.length <= 1}
            >
              Previous
            </button>
            <button
              className="bg-gray-200 text-gray-600 px-4 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition"
              onClick={() => fetchNotifications("next")}
              disabled={!hasNext}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
