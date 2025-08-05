import React from "react";

const ItemsPerPageSelector = ({ value, onChange, options = [5, 10, 20, 50] }) => {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <label htmlFor="items-per-page">Rows per page:</label>
      <select
        id="items-per-page"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring focus:border-blue-400"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ItemsPerPageSelector;
