import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function LoginPage() {
  const { login, isAuthenticated, role, isSuperAdmin, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const resetSuccess = searchParams.get("reset") === "success";

  const fromLocation = location.state?.from?.pathname;

  // Determine destination
  const getDestination = (userRole) => {
    if (
      fromLocation &&
      fromLocation !== "/login" &&
      fromLocation !== "/unauthorized" &&
      fromLocation !== "/app/login" &&
      fromLocation !== "/app/unauthorized"
    ) {
      return fromLocation;
    }
    if (userRole === "super_admin" || userRole === "admin") return "/app/admin";
    if (userRole === "teacher") return "/app/teacher";
    if (userRole === "student") return "/app/student";
    return "/app";
  };

  // If already logged in, redirect directly
  if (isAuthenticated && !isSubmitting) {
    const dest = getDestination(role);
    navigate(dest, { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await login(email, password);
      const destination = getDestination(user.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-neutral-900 text-center tracking-tight">Account Sign In</h2>
        <p className="text-xs text-neutral-500 text-center mt-1">
          Enter your credentials to access your learning portal
        </p>
      </div>

      {resetSuccess && (
        <div
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
          role="status"
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">Your password has been reset successfully. Please sign in with your new password.</span>
        </div>
      )}

      {errorMessage && (
        <div
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
          role="alert"
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isSubmitting}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-300 focus:border-[#CA8A04] focus:ring-2 focus:ring-[#CA8A04] text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-all disabled:opacity-60 min-h-[44px]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Password
            </label>
            <Link
              to="/app/forgot-password"
              className="text-xs font-semibold text-[#CA8A04] hover:text-[#A16207] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 pr-14 rounded-xl bg-white border border-neutral-300 focus:border-[#CA8A04] focus:ring-2 focus:ring-[#CA8A04] text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-all disabled:opacity-60 min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black font-semibold text-xs px-2 py-1 rounded focus:outline-none min-h-[32px] flex items-center"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>
    </div>
  );
}
