// src/components/users/UserFilters.jsx
const UserFilters = ({
  planTypeFilter,
  statusFilter,
  languageFilter,
  query,
  onPlanTypeChange,
  onStatusChange,
  onLanguageChange,
  onQueryChange,
  onResetFilters,
}) => {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plan
        </label>
        <select
          value={planTypeFilter}
          onChange={onPlanTypeChange}
          className="border rounded px-3 py-2 w-44"
        >
          <option value="">All</option>
          <option value="premium">Premium</option>
          <option value="gift">Gift</option>
          <option value="free">Free</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={statusFilter}
          onChange={onStatusChange}
          className="border rounded px-3 py-2 w-44"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Language
        </label>
        <select
          value={languageFilter}
          onChange={onLanguageChange}
          className="border rounded px-3 py-2 w-36"
        >
          <option value="">All</option>
          <option value="fa">FA</option>
          <option value="en">EN</option>
        </select>
      </div>

      <div className="flex-1 min-w-[220px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search (UID / tokenId / codeId)
        </label>
        <input
          value={query}
          onChange={onQueryChange}
          placeholder="e.g. 1a2b3c, tok_..., code_..."
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      <button
        onClick={onResetFilters}
        className="text-sm text-red-600 hover:underline ml-auto"
      >
        Reset
      </button>
    </div>
  );
};

export default UserFilters;
