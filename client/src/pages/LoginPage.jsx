import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
        <h2 className="text-xl font-bold text-white text-center">Account Sign In</h2>
        <p className="text-xs text-slate-400 text-center mt-1">
          Enter your credentials to access the React dashboard
        </p>
      </div>

      {errorMessage && (
        <div
          className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2"
          role="alert"
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            disabled={isSubmitting}
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors disabled:opacity-60"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300">
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Forgot password? (EJS)
            </a>
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
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-slate-950/80 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
