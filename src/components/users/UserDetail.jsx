import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseApp from "../../firebase/firebaseConfig";

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = doc(db, "users", id);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser({ id: userSnap.id, ...userSnap.data() });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("خطا در دریافت کاربر:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  if (loading) return <div className="p-6">در حال بارگذاری...</div>;
  if (!user) return <div className="p-6 text-red-600">کاربر پیدا نشد.</div>;

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">User Details</h2>
          <button
            onClick={() => navigate("/admin/users")}
            className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
          >
            ← بازگشت به لیست کاربران
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
          <div><span className="font-semibold">Name:</span> {user.name}</div>
          <div><span className="font-semibold">Status:</span> {user.status}</div>
          <div><span className="font-semibold">Subscription:</span> {user.subscription}</div>
          <div><span className="font-semibold">Activation:</span> {user.activation}</div>
          <div><span className="font-semibold">Expiration:</span> {user.expiration}</div>
          <div><span className="font-semibold">Usage:</span> {user.dataUsage}</div>
          <div><span className="font-semibold">Payment Type:</span> {user.purchType}</div>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
