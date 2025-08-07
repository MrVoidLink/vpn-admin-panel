import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function NotificationForm({ afterSend }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [type, setType] = useState("info");
  const [scheduleAt, setScheduleAt] = useState("");
  const [targetGroup, setTargetGroup] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    let scheduleTimestamp = null;
    if (scheduleAt) {
      const date = new Date(scheduleAt);
      if (!isNaN(date)) scheduleTimestamp = date;
    }

    try {
      await addDoc(collection(db, "notifications"), {
        title,
        body,
        priority,
        type,
        scheduleAt: scheduleTimestamp,
        targetGroup,
        createdAt: serverTimestamp(),
        status: "pending",
        sentAt: null,
        senderAdminId: "admin123",
        errorMessage: null,
      });
      setTitle("");
      setBody("");
      setPriority("normal");
      setType("info");
      setScheduleAt("");
      setTargetGroup("all");
      setMessage({ type: "success", text: "Notification saved successfully!" });
      afterSend && afterSend();
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-lg p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-center"
    >
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        required
        className="col-span-1 md:col-span-2 border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
      />
      <textarea
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={2}
        required
        className="col-span-1 md:col-span-3 border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="col-span-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        title="Priority"
      >
        <option value="low">Low Priority</option>
        <option value="normal">Normal Priority</option>
        <option value="high">High Priority</option>
      </select>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="col-span-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        title="Type"
      >
        <option value="info">Info</option>
        <option value="alert">Alert</option>
        <option value="promo">Promo</option>
      </select>
      <select
        value={targetGroup}
        onChange={(e) => setTargetGroup(e.target.value)}
        className="col-span-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        title="Target Group"
      >
        <option value="all">All Users</option>
        <option value="premium">Premium Users</option>
        <option value="vip">VIP Users</option>
      </select>
      <input
        type="datetime-local"
        value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
        className="col-span-1 md:col-span-2 border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        title="Schedule At"
      />
      <button
        type="submit"
        disabled={loading}
        className="col-span-1 md:col-span-1 bg-blue-600 text-white rounded-md px-6 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
      >
        {loading ? "Sending..." : "Send"}
      </button>

      {message && (
        <div
          className={`col-span-full text-center mt-2 py-2 rounded-md font-semibold
          ${message.type === "success"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-700"}`}
          role="alert"
        >
          {message.text}
        </div>
      )}
    </form>
  );
}
