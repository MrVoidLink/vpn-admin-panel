import React from "react";
import { Link } from "react-router-dom";

const UserTable = ({ users }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-md mt-4">
      <table className="min-w-full text-sm text-gray-800">
        <thead className="bg-gray-100 text-left uppercase text-xs text-gray-600">
          <tr>
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Subscription</th>
            <th className="px-5 py-3">Activation</th>
            <th className="px-5 py-3">Expiration</th>
            <th className="px-5 py-3">Usage</th>
            <th className="px-5 py-3">Payment</th>
            <th className="px-5 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => (
            <tr
              key={user.id}
              className={`hover:bg-gray-50 border-b ${
                idx % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <td className="px-5 py-4">
                <Link
                  to={`/admin/users/${user.id}`}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  {user.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                    user.status === "online"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="px-5 py-4">{user.subscription}</td>
              <td className="px-5 py-4">{user.activation}</td>
              <td className="px-5 py-4">{user.expiration}</td>
              <td className="px-5 py-4">{user.dataUsage}</td>
              <td className="px-5 py-4">{user.purchType}</td>
              <td className="px-5 py-4">
                <Link
                  to={`/admin/users/${user.id}`}
                  className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
