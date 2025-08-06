import React, { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const PAGE_SIZE = 10;

const FileHistory = ({ files }) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination logic
  const totalPages = Math.ceil((files?.length || 0) / PAGE_SIZE);
  const paginatedFiles = files
    ? files.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : [];

  const handleDownload = (file) => {
    try {
      if (!file.codes || !Array.isArray(file.codes)) {
        alert("No codes registered for this file!");
        return;
      }
      const worksheetData = file.codes.map((code) => ({
        "Code": code.code,
        "Duration (days)": code.duration,
        "Device Limit": code.deviceLimit,
        "Type": code.type,
        "Created At": code.createdAt
          ? new Date(
              code.createdAt._seconds
                ? code.createdAt._seconds * 1000
                : code.createdAt
            ).toLocaleString("en-GB")
          : "",
        "Used?": code.isUsed ? "Used" : "Unused",
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, file.name);
    } catch (error) {
      console.error("❌ Error downloading file:", error);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Excel Files History</h2>
      <table className="min-w-full bg-white rounded-xl shadow overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="py-2 px-3 text-left">Filename</th>
            <th className="py-2 px-3 text-left">Date</th>
            <th className="py-2 px-3 text-left">Count</th>
            <th className="py-2 px-3 text-left">Type</th>
            <th className="py-2 px-3 text-left">Download</th>
          </tr>
        </thead>
        <tbody>
          {paginatedFiles && paginatedFiles.length > 0 ? (
            paginatedFiles.map((file, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-50 transition"
              >
                <td className="py-2 px-3">{file.name}</td>
                <td className="py-2 px-3">
                  {file.createdAt ? new Date(file.createdAt).toLocaleString("en-GB") : ""}
                </td>
                <td className="py-2 px-3">{file.count}</td>
                <td className="py-2 px-3 capitalize">{file.type}</td>
                <td className="py-2 px-3">
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                    onClick={() => handleDownload(file)}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-400">
                No files found!
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 font-medium"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, idx) => (
            <button
              key={idx}
              className={`px-3 py-1 rounded font-medium ${
                currentPage === idx + 1
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
              onClick={() => setCurrentPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 font-medium"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
