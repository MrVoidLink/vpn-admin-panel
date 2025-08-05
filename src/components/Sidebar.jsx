import { NavLink, useNavigate } from "react-router-dom";
import {
  FaChartBar,
  FaUser,
  FaKey,
  FaServer,
  FaListAlt,
  FaCog,
  FaSignOutAlt,
  FaBell,
} from "react-icons/fa";

import { getAuth, signOut } from "firebase/auth";

const menuItems = [
  { label: "Dashboard", icon: <FaChartBar />, path: "/admin/dashboard" },
  { label: "Users", icon: <FaUser />, path: "/admin/users" },
  { label: "Generate Code", icon: <FaKey />, path: "/admin/generate-code" },
  { label: "Add Server", icon: <FaServer />, path: "/admin/add-server" },
  { label: "Subscription Plans", icon: <FaListAlt />, path: "/admin/subscription-plans" },
  { label: "Send Notification", icon: <FaBell />, path: "/admin/send-notification" }, // ✅ اضافه شد
  { label: "Settings", icon: <FaCog />, path: "/admin/settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <aside className="w-64 h-screen bg-white border-r shadow-md p-5 flex flex-col">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Admin Panel</h2>
      <nav className="space-y-2 flex-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                isActive ? "bg-gray-100 text-blue-600" : "text-gray-700 hover:bg-gray-50"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-6 flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
      >
        <FaSignOutAlt />
        <span>Logout</span>
      </button>
    </aside>
  );
}
