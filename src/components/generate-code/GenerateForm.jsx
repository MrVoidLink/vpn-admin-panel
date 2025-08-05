import React, { useState } from "react";

const GenerateForm = ({ onGenerate }) => {
  const [count, setCount] = useState(10);
  const [validForDays, setValidForDays] = useState(30);
  const [deviceLimit, setDeviceLimit] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({ count, validForDays, deviceLimit });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1">
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

        <div className="flex-1">
          <label className="block mb-1 font-medium">مدت اعتبار</label>
          <select
            value={validForDays}
            onChange={(e) => setValidForDays(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value={30}>1 ماهه</option>
            <option value={60}>2 ماهه</option>
            <option value={90}>3 ماهه</option>
            <option value={180}>6 ماهه</option>
            <option value={365}>1 ساله</option>
          </select>
        </div>

        <div className="flex-1">
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
