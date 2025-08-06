import React from "react";

const CodeTable = ({ codes }) => {
  if (!codes || codes.length === 0) {
    return <p className="text-gray-500 mt-4">No codes have been generated.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg mt-6 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Code</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Validity (days)</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Devices</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {codes.map((code, index) => (
            <tr key={index} className="hover:bg-gray-50 transition">
              <td className="px-4 py-2 text-sm font-mono">{code.code}</td>
              <td className="px-4 py-2 text-sm">{code.validForDays}</td>
              <td className="px-4 py-2 text-sm">{code.deviceLimit} user{code.deviceLimit > 1 ? 's' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CodeTable;
