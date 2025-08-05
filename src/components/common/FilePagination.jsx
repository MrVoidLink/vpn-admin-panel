import React from "react";

const FilePagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex justify-center mt-4 space-x-2">
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 rounded-md border ${
            currentPage === page
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-blue-100"
          }`}
        >
          {page}
        </button>
      ))}
    </div>
  );
};

export default FilePagination;
