import React, { useState } from "react";

const GenerateForm = ({ onGenerate }) => {
  const [count, setCount] = useState(10);
  const [validForDays, setValidForDays] = useState(30);
  const [maxDevices, setMaxDevices] = useState(1);
  const [type, setType] = useState("premium");

  const handleSubmit = (e) => {
    e.preventDefault();
    // ✅ فقط اسکیمای v2 ارسال می‌شود
    onGenerate({ count, validForDays, maxDevices, type });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-xl shadow-md space-y-4"
    >
      <div className="flex flex-col md:flex-row gap-4 items-center flex-wrap">

        {/* Subscription Type */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium text-gray-700">Subscription Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="premium">Premium (Paid)</option>
            <option value="gift">Gift (Limited)</option>
          </select>
        </div>

        {/* Code Count */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium text-gray-700">Code Count</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Validity (Days) */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium text-gray-700">Validity (days)</label>
          <select
            value={validForDays}
            onChange={(e) => setValidForDays(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value={15}>15 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
          </select>
        </div>

        {/* Max Devices */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium text-gray-700">Max devices</label>
          <select
            value={maxDevices}
            onChange={(e) => setMaxDevices(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value={1}>1 device</option>
            <option value={2}>2 devices</option>
            <option value={3}>3 devices</option>
          </select>
        </div>

        {/* Button */}
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 transition mt-6 md:mt-0"
        >
          Generate Code
        </button>
      </div>
    </form>
  );
};

export default GenerateForm;
