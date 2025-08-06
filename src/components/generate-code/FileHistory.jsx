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
        alert("هیچ کدی برای این فایل ثبت نشده!");
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
            ).toLocaleString("fa-IR")
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
      <h2 className="text-lg font-semibold mb-4">تاریخچه فایل‌های اکسل</h2>
      <table className="min-w-full bg-white rounded-xl shadow">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Date</th>
            <th>Count</th>
            <th>Type</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {paginatedFiles && paginatedFiles.length > 0 ? (
            paginatedFiles.map((file, idx) => (
              <tr key={idx}>
                <td>{file.name}</td>
                <td>{file.createdAt ? new Date(file.createdAt).toLocaleString("fa-IR") : ""}</td>
                <td>{file.count}</td>
                <td>{file.type}</td>
                <td>
                  <button
                    className="px-2 py-1 bg-blue-500 text-white rounded-lg"
                    onClick={() => handleDownload(file)}
                  >
                    دانلود
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center">
                هیچ فایلی ثبت نشده!
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
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            قبلی
          </button>
          {Array.from({ length: totalPages }, (_, idx) => (
            <button
              key={idx}
              className={`px-3 py-1 rounded ${currentPage === idx + 1 ? "bg-blue-500 text-white" : "bg-gray-100"}`}
              onClick={() => setCurrentPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
