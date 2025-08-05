import { useEffect, useState } from "react";
import UserFilters from "../components/users/UserFilters";
import UserTable from "../components/users/UserTable";
import Pagination from "../components/common/Pagination";
import { seedFakeUsers } from "../utils/seedFakeUsers";

import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseApp from "../firebase/firebaseConfig";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // فیلترها
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");

  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const userList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(userList);
      } catch (error) {
        console.error("خطا در دریافت کاربران:", error);
      }
    };

    fetchUsers();
  }, []);

  // اعمال فیلترها
  const filteredUsers = users.filter((user) => {
    const matchesSubscription =
      !subscriptionFilter || user.subscription === subscriptionFilter;

    const matchesStatus =
      !statusFilter || user.status === statusFilter;

    const matchesPayment =
      !paymentTypeFilter ||
      user.purchType.toLowerCase().includes(paymentTypeFilter.toLowerCase());

    return matchesSubscription && matchesStatus && matchesPayment;
  });

  // محاسبه تعداد صفحات
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  // گرفتن کاربران مربوط به صفحه فعلی
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>

      <UserFilters
        subscriptionFilter={subscriptionFilter}
        statusFilter={statusFilter}
        paymentTypeFilter={paymentTypeFilter}
        onSubscriptionChange={(e) => setSubscriptionFilter(e.target.value)}
        onStatusChange={(e) => setStatusFilter(e.target.value)}
        onPaymentTypeChange={(e) => setPaymentTypeFilter(e.target.value)}
        onResetFilters={() => {
          setSubscriptionFilter("");
          setStatusFilter("");
          setPaymentTypeFilter("");
        }}
      />

      <UserTable users={paginatedUsers} />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
      />

      <button
        onClick={() => seedFakeUsers(20)}
        className="mt-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        افزودن ۲۰ کاربر فیک
      </button>
    </div>
  );
};

export default Users;
