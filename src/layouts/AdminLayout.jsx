import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => setSidebarOpen(false);
    window.addEventListener("closeSidebar", handleClose);
    return () => window.removeEventListener("closeSidebar", handleClose);
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-100 relative">
      {/* دکمه موبایل */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-200 text-gray-700 shadow-md md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <FaBars size={20} />
      </button>

      {/* بکدراپ موبایل */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar در دسکتاپ */}
      <div className="hidden md:block w-64 h-screen bg-white border-r shadow-md overflow-y-auto z-30">
        <Sidebar />
      </div>

      {/* Sidebar موبایل */}
      {sidebarOpen && (
        <div className="md:hidden fixed top-0 left-0 w-64 h-screen bg-white border-r shadow-md z-50 overflow-y-auto">
          <div className="flex justify-end p-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <Sidebar />
        </div>
      )}

      {/* محتوای اصلی */}
      <main className="flex-1 p-6 overflow-auto z-10 relative bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
