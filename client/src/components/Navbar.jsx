import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "./RoleBadge.jsx";

export default function Navbar() {
  const { user, isAuthenticated, logout, isSuperAdmin, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/app/login");
  };

  // Determine dashboard link
  let dashboardHref = "/app/login";
  if (isSuperAdmin) dashboardHref = "/app/admin";
  else if (isTeacher) dashboardHref = "/app/teacher";
  else if (isStudent) dashboardHref = "/app/student";

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/app" className="flex items-center gap-3 group">
              <img
                src="/EDUviber_LOGO.png"
                alt="EDUviber Logo"
                className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <span className="text-xl font-bold tracking-tight text-white flex items-center">
                EDU<span className="text-amber-500">viber</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  React
                </span>
              </span>
            </Link>

            {/* Navigation links */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link to="/app" className="text-slate-300 hover:text-white transition-colors">
                Home
              </Link>
              {/* EJS Catalog Link */}
              <a
                href="/courses"
                className="text-slate-300 hover:text-amber-400 transition-colors flex items-center gap-1"
                title="View Course Catalog (EJS Application)"
              >
                <span>Courses</span>
                <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-1">EJS</span>
              </a>
              {isAuthenticated && (
                <Link
                  to={dashboardHref}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-bold text-xs uppercase">
                    {user?.name ? user.name.charAt(0) : "U"}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-slate-200 leading-none">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{user?.email}</p>
                  </div>
                  <RoleBadge role={user?.role} />
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <a
                  href="/login"
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  EJS Login
                </a>
                <Link
                  to="/app/login"
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all font-bold"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-2">
          <Link
            to="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800"
          >
            Home
          </Link>
          <a
            href="/courses"
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-amber-400 hover:bg-slate-800"
          >
            Courses (EJS)
          </a>
          {isAuthenticated ? (
            <>
              <Link
                to={dashboardHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-amber-400 hover:bg-slate-800"
              >
                Dashboard
              </Link>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300"
                >
                  Log Out
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/app/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center px-4 py-2 rounded-lg bg-amber-500 font-bold text-slate-950 text-sm mt-3"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
