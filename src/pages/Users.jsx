// src/pages/Users.jsx
import { useEffect, useMemo, useState } from "react";
import UserFilters from "../components/users/UserFilters";
import UserTable from "../components/users/UserTable";
import Pagination from "../components/common/Pagination";

import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseApp from "../firebase/firebaseConfig";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // فیلترها/جستجو
  const [planTypeFilter, setPlanTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [query, setQuery] = useState(""); // جستجو روی uid/tokenId/codeId

  // صفحه‌بندی
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const userList = snapshot.docs.map((doc) => ({
          uid: doc.id, // کلید سند
          ...doc.data(),
        }));
        setUsers(userList);
      } catch (err) {
        console.error("خطا در دریافت کاربران:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchPlan = !planTypeFilter || (u.planType || "") === planTypeFilter;
      const matchStatus = !statusFilter || (u.status || "") === statusFilter;
      const matchLang = !languageFilter || (u.language || "") === languageFilter;

      const codeId = u?.subscription?.codeId || "";
      const tokenId = u?.tokenId || "";
      const searchHit =
        !q ||
        (u.uid || "").toLowerCase().includes(q) ||
        tokenId.toLowerCase().includes(q) ||
        (codeId + "").toLowerCase().includes(q);

      return matchPlan && matchStatus && matchLang && searchHit;
    });
  }, [users, planTypeFilter, statusFilter, languageFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>

      <UserFilters
        planTypeFilter={planTypeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        query={query}
        onPlanTypeChange={(e) => {
          setPlanTypeFilter(e.target.value);
          setCurrentPage(1);
        }}
        onStatusChange={(e) => {
          setStatusFilter(e.target.value);
          setCurrentPage(1);
        }}
        onLanguageChange={(e) => {
          setLanguageFilter(e.target.value);
          setCurrentPage(1);
        }}
        onQueryChange={(e) => {
          setQuery(e.target.value);
          setCurrentPage(1);
        }}
        onResetFilters={() => {
          setPlanTypeFilter("");
          setStatusFilter("");
          setLanguageFilter("");
          setQuery("");
          setCurrentPage(1);
        }}
      />

      {loading ? (
        <div className="mt-6 text-gray-600">در حال بارگذاری کاربران…</div>
      ) : (
        <>
          <UserTable users={paginatedUsers} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </>
      )}
    </div>
  );
};

export default Users;
