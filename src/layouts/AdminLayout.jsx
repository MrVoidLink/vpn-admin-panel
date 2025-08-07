import React from "react";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="fixed top-0 left-0 w-64 h-screen bg-white border-r shadow-md overflow-y-auto">
        <Sidebar />
      </aside>
      <main className="ml-64 flex-1 overflow-auto p-6 bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
