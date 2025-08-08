import { NavLink, useNavigate } from "react-router-dom";
import {
  FaChartBar,
  FaUser,
  FaKey,
  FaServer,
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
  { label: "Server Management", icon: <FaServer />, path: "/admin/server-management" },
  { label: "Send Notification", icon: <FaBell />, path: "/admin/send-notification" },
  { label: "Settings", icon: <FaCog />, path: "/admin/settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleMobileNav = () => {
    if (window.innerWidth < 768) {
      document.dispatchEvent(new CustomEvent("closeSidebar"));
    }
  };

  return (
    <nav className="flex flex-col h-full text-gray-700">
      <h2 className="text-2xl font-bold mb-8 text-gray-900">Admin Panel</h2>
      <ul className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.path}
              onClick={handleMobileNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-md text-base font-medium transition
                 ${
                   isActive
                     ? "bg-blue-100 text-blue-700 font-semibold"
                     : "hover:bg-gray-100 text-gray-700"
                 }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition text-gray-700"
      >
        <FaSignOutAlt />
        <span>Logout</span>
      </button>
    </nav>
  );
}
