import React from "react";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* کارت‌های آماری اصلی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: "Total Users", value: "1,240" },
          { title: "Online Users", value: "87" },
          { title: "Active Servers", value: "12" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-md hover:shadow-lg transition"
          >
            <p className="text-sm text-gray-500">{item.title}</p>
            <h3 className="text-3xl font-bold text-blue-800 mt-2">
              {item.value}
            </h3>
          </div>
        ))}
      </div>

      {/* نمودار فعالیت کاربران */}
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          User Activity (7 days)
        </h3>
        <div className="h-40 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg flex items-center justify-center text-gray-400">
          Chart Placeholder 📊
        </div>
      </div>

      {/* آخرین رویدادها */}
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          Quick Insights
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>✅ 3 new users joined today</li>
          <li>⚠️ Server #4 usage is high</li>
          <li>🔐 5 new codes generated</li>
        </ul>
      </div>
    </div>
  );
}
