const UserFilters = ({
  subscriptionFilter,
  statusFilter,
  paymentTypeFilter,
  onSubscriptionChange,
  onStatusChange,
  onPaymentTypeChange,
  onResetFilters,
}) => {
  return (
    <div className="flex flex-wrap gap-4 mb-4 items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subscription
        </label>
        <select
          value={subscriptionFilter}
          onChange={onSubscriptionChange}
          className="border rounded px-3 py-2 w-40"
        >
          <option value="">All</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="premium plus">Premium Plus</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={statusFilter}
          onChange={onStatusChange}
          className="border rounded px-3 py-2 w-40"
        >
          <option value="">All</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment
        </label>
        <select
          value={paymentTypeFilter}
          onChange={onPaymentTypeChange}
          className="border rounded px-3 py-2 w-40"
        >
          <option value="">All</option>
          <option value="card">Card</option>
          <option value="crypto">Crypto</option>
        </select>
      </div>

      <button
        onClick={onResetFilters}
        className="text-sm text-red-600 hover:underline ml-4"
      >
        Reset Filters
      </button>
    </div>
  );
};

export default UserFilters;
