import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "./RoleBadge.jsx";
import NotificationBell from "./NotificationBell.jsx";

export default function Navbar({ onToggleMobileSidebar }) {
  const { user, isAuthenticated, logout, isSuperAdmin, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/app/login");
  };

  // Determine primary dashboard link
  let dashboardHref = "/app/login";
  if (isSuperAdmin) dashboardHref = "/app/admin";
  else if (isTeacher) dashboardHref = "/app/teacher";
  else if (isStudent) dashboardHref = "/app/student";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo & Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 sm:gap-6">
            {isAuthenticated && onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                aria-label="Open navigation menu"
                className="md:hidden p-2 -ml-2 rounded-xl text-neutral-700 hover:text-black hover:bg-neutral-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            <Link to="/app" className="flex items-center gap-2.5 group select-none">
              <img
                src="/EDUviber_LOGO.png"
                alt="EDUviber Logo"
                className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <span className="text-xl font-black tracking-tight text-black flex items-center">
                EDU<span className="text-[#CA8A04]">viber</span>
              </span>
            </Link>

            {/* Desktop Quick Nav */}
            <nav className="hidden md:flex items-center gap-7 ml-2 text-sm font-semibold">
              <Link to="/app" className="text-neutral-600 hover:text-black transition-colors">
                Home
              </Link>
              <a
                href="/courses"
                className="text-neutral-600 hover:text-black transition-colors"
                title="View Course Catalog"
              >
                Courses
              </a>
              {isAuthenticated && (
                <Link to={dashboardHref} className="text-neutral-600 hover:text-black transition-colors">
                  Dashboard
                </Link>
              )}
            </nav>
          </div>

          {/* Right: Authenticated User Actions or Guest Login */}
          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <>
                {/* In-app Notification Bell */}
                <NotificationBell />

                {/* Role Badge Indicator */}
                <div className="hidden sm:block">
                  <RoleBadge role={user?.role} />
                </div>

                {/* User Menu Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    aria-expanded={userDropdownOpen}
                    aria-label="User account menu"
                    className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition min-h-[44px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center">
                      {user?.name ? user.name[0].toUpperCase() : "U"}
                    </div>
                    <div className="hidden sm:block text-left text-xs">
                      <p className="font-bold text-neutral-900 leading-tight truncate max-w-[120px]">{user?.name}</p>
                      <p className="text-[11px] text-neutral-500 leading-tight truncate max-w-[120px]">{user?.email}</p>
                    </div>
                    <svg className="hidden sm:block w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-dropdown border border-neutral-200 p-2 z-50 space-y-1">
                        <div className="px-3 py-2 border-b border-neutral-100">
                          <p className="text-xs font-bold text-neutral-900">{user?.name}</p>
                          <p className="text-[11px] text-neutral-500 truncate">{user?.email}</p>
                          <div className="mt-1 sm:hidden">
                            <RoleBadge role={user?.role} />
                          </div>
                        </div>

                        <Link
                          to={dashboardHref}
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-black transition"
                        >
                          <span>Dashboard</span>
                        </Link>

                        {isStudent && (
                          <Link
                            to="/app/student/settings"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-black transition"
                          >
                            <span>Devices & Settings</span>
                          </Link>
                        )}

                        {isTeacher && (
                          <Link
                            to="/app/teacher/profile"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-black transition"
                          >
                            <span>Instructor Profile</span>
                          </Link>
                        )}

                        <div className="pt-1 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                          >
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/app/login"
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg text-neutral-800 hover:text-black border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition min-h-[44px] flex items-center justify-center active:scale-[0.99]"
                >
                  Sign In
                </Link>
                <a
                  href="/courses"
                  className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-bold rounded-lg bg-black text-white hover:bg-neutral-800 transition min-h-[44px] items-center justify-center shadow-xs active:scale-[0.99]"
                >
                  Browse Courses
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
