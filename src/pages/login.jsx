import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import firebaseApp from "../firebase/firebaseConfig";
import { toast } from "react-toastify"; // ✅ اضافه شد

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast.success(`خوش آمدید ${userCredential.user.email} 👋`);
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("❌ Login error:", err.message);
      setError("ایمیل یا رمز عبور اشتباه است.");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left graphic section */}
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-400 items-center justify-center text-white p-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">Welcome Back, Admin!</h2>
          <p className="text-lg opacity-90">
            Manage users, track performance, and customize your platform.
          </p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-6 py-12 bg-gray-100">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Admin Panel Login
          </h2>

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2 text-sm text-blue-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm text-gray-600">
                <input type="checkbox" className="h-4 w-4 mr-2" />
                Remember me
              </label>
              <a href="#" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-200"
            >
              Sign In
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <p className="text-red-600 text-sm mt-4 text-center">{error}</p>
          )}

          <p className="text-sm text-center text-gray-500 mt-6">
            Don’t have an account?{" "}
            <a href="#" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
