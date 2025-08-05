import React, { useState } from "react";

const SendNotification = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !message) {
      setStatus({ type: "error", text: "لطفاً عنوان و پیام را وارد کنید." });
      return;
    }

    setLoading(true);
    setStatus(null);

    setTimeout(() => {
      setLoading(false);
      setStatus({ type: "success", text: "✅ نوتیفیکیشن با موفقیت ارسال شد." });
      setTitle("");
      setMessage("");
    }, 1500);
  };

  return (
    <div className="p-6 min-h-screen bg-gradient-to-tr from-blue-50 via-white to-blue-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl p-8 animate-fade-in">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-blue-600 text-3xl">📣</span>
          <h1 className="text-2xl font-bold text-gray-800">ارسال نوتیفیکیشن</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">عنوان</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="مثلاً: اطلاعیه مهم"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">متن پیام</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="مثلاً: نسخه جدید اپ منتشر شد، لطفاً به‌روزرسانی کنید..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-all duration-300 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "در حال ارسال..." : "ارسال نوتیفیکیشن"}
          </button>

          {status && (
            <div
              className={`text-sm text-center py-2 rounded-lg transition-all duration-300 ${
                status.type === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {status.text}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SendNotification;
