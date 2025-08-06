import React, { useState } from "react";
import FilePagination from "../common/FilePagination";
import { saveAs } from "file-saver";

const FileHistory = ({ files }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const filesPerPage = 6;

  const totalPages = Math.ceil(files.length / filesPerPage);
  const paginatedFiles = files.slice(
    (currentPage - 1) * filesPerPage,
    currentPage * filesPerPage
  );

  const handleDownload = (file) => {
    try {
      saveAs(file.blob, file.name);
    } catch (error) {
      console.error("❌ Error downloading file:", error);
    }
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold mb-4">History of Generated Files</h2>

      {paginatedFiles.length === 0 ? (
        <p className="text-gray-500">No files generated yet.</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">File Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Created At</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th> {/* 🔹 جدید */}
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Validity</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Devices</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Codes</th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedFiles.map((file, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{file.name}</td>
                  <td className="px-4 py-2 text-sm">{file.createdAt}</td>
                  <td className="px-4 py-2 text-sm">
                    {file.type === "gift" ? "هدیه" : "پریمیوم"}
                  </td> {/* 🔹 جدید */}
                  <td className="px-4 py-2 text-sm">{file.validForDays} روز</td>
                  <td className="px-4 py-2 text-sm">{file.deviceLimit} کاربره</td>
                  <td className="px-4 py-2 text-sm">{file.count}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDownload(file)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <FilePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default FileHistory;
