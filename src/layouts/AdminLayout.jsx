import React from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* هدر بالای پنل */}
      <Header />

      {/* بدنه اصلی */}
      <div className="flex flex-1">
        {/* سایدبار در سمت چپ */}
        <Sidebar />

        {/* محتوای متغیر صفحات */}
        <main className="flex-1 bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
