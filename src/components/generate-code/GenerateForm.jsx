import React, { useState } from "react";

const GenerateForm = ({ onGenerate }) => {
  const [count, setCount] = useState(10);
  const [validForDays, setValidForDays] = useState(30);
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [type, setType] = useState("premium");

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({ count, validForDays, deviceLimit, type });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center flex-wrap">

        {/* نوع اشتراک */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium">نوع اشتراک</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="premium">پریمیوم (پولی)</option>
            <option value="gift">هدیه (محدود)</option>
          </select>
        </div>

        {/* تعداد کد */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium">تعداد کد</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* مدت اعتبار */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium">مدت اعتبار (روز)</label>
          <select
            value={validForDays}
            onChange={(e) => setValidForDays(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value={15}>15 روزه</option>
            <option value={30}>30 روزه</option>
            <option value={60}>60 روزه</option>
            <option value={90}>90 روزه</option>
            <option value={180}>6 ماهه</option>
            <option value={365}>1 ساله</option>
          </select>
        </div>

        {/* تعداد کاربر */}
        <div className="flex-1 min-w-[200px]">
          <label className="block mb-1 font-medium">تعداد کاربر</label>
          <select
            value={deviceLimit}
            onChange={(e) => setDeviceLimit(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value={1}>تک کاربره</option>
            <option value={2}>دو کاربره</option>
            <option value={3}>سه کاربره</option>
          </select>
        </div>

        {/* دکمه */}
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          تولید کد
        </button>
      </div>
    </form>
  );
};

export default GenerateForm;
