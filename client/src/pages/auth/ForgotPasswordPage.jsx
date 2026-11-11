import React, { useState } from "react";
import { Link } from "react-router-dom";
import { requestForgotPassword } from "../../api/publicApi.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestForgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Unable to send reset instructions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Forgot Password</h1>
        <p className="text-xs text-neutral-500 font-medium">
          Enter your account email to receive a password recovery link.
        </p>
      </div>

      <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <h2 className="text-base font-bold text-neutral-900">Recovery Email Sent</h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              If an account is associated with <span className="font-semibold text-black">{email}</span>, a reset
              link has been dispatched. Please check your inbox and spam folder.
            </p>
            <div className="pt-2">
              <Link
                to="/app/login"
                className="text-xs font-bold text-[#CA8A04] hover:underline"
              >
                Return to Sign In
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
              <label htmlFor="email" className="text-xs font-bold text-neutral-800 block">
                Account Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#CA8A04] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending link..." : "Send Reset Link"}
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
