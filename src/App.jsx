import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserDetail from "./components/users/UserDetail";
import GenerateCode from "./pages/GenerateCode";
import SendNotification from "./pages/SendNotification"; // ✅ اضافه شد
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* صفحه لاگین */}
        <Route path="/login" element={<Login />} />

        {/* صفحات داخل پنل ادمین - محافظت‌شده */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="generate-code" element={<GenerateCode />} />
          <Route path="send-notification" element={<SendNotification />} /> {/* ✅ روت جدید */}
        </Route>

        {/* مسیر پیش‌فرض */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
