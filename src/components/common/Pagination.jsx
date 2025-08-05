import React from "react";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisible = 5,
}) => {
  if (totalPages === 0) return null;

  const pages = [];

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = startPage + maxVisible - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const handleChange = (page) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between mt-6 border-t pt-4 text-sm text-gray-700">
      <div className="flex items-center gap-1">
        <button
          className="px-2 py-1 rounded hover:bg-gray-200 disabled:text-gray-400"
          onClick={() => handleChange(1)}
          disabled={currentPage === 1}
        >
          «
        </button>
        <button
          className="px-2 py-1 rounded hover:bg-gray-200 disabled:text-gray-400"
          onClick={() => handleChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
        </button>

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => handleChange(page)}
            className={`px-3 py-1 rounded ${
              currentPage === page
                ? "bg-blue-600 text-white font-semibold"
                : "hover:bg-gray-100"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          className="px-2 py-1 rounded hover:bg-gray-200 disabled:text-gray-400"
          onClick={() => handleChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
        <button
          className="px-2 py-1 rounded hover:bg-gray-200 disabled:text-gray-400"
          onClick={() => handleChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          »
        </button>
      </div>

      <div className="text-sm ml-auto text-gray-600">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
};

export default Pagination;
