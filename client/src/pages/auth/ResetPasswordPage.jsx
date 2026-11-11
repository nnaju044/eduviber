import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { submitResetPassword } from "../../api/publicApi.js";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing from the URL. Please use the exact link sent to your email.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      await submitResetPassword({ token, password, confirmPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Password reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Create New Password</h1>
        <p className="text-xs text-neutral-500 font-medium">
          Choose a strong password with at least 8 characters.
        </p>
      </div>

      <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <h2 className="text-base font-bold text-neutral-900">Password Updated!</h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Your password has been securely reset. You can now log in with your new credentials.
            </p>
            <div className="pt-2">
              <Link
                to="/app/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-black hover:bg-neutral-800"
              >
                Sign In Now →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="pass" className="text-xs font-bold text-neutral-800 block">
                New Password
              </label>
              <input
                id="pass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#CA8A04] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm" className="text-xs font-bold text-neutral-800 block">
                Confirm New Password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3.5 py-2.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#CA8A04] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Reset Password"}
            </button>

            <div className="text-center pt-2">
              <Link to="/app/login" className="text-xs text-neutral-500 hover:text-black font-semibold">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
