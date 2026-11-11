import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Sidebar({ isOpen, onClose }) {
  const { role, isSuperAdmin, isTeacher, isStudent } = useAuth();

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px] ${isActive
      ? "bg-black text-white shadow-sm"
      : "text-neutral-600 hover:text-black hover:bg-neutral-100/80"
    }`;

  const navContent = (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-6">
        {/* Section Header */}
        <div className="px-3 pt-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
            {isSuperAdmin && "Super Admin Console"}
            {isTeacher && "Teacher Studio"}
            {isStudent && "Student Portal"}
            {!role && "Navigation"}
          </p>
        </div>

        {/* Super Admin Navigation */}
        {isSuperAdmin && (
          <nav className="space-y-1">
            <NavLink to="/app/admin" end className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Overview</span>
            </NavLink>
            <NavLink to="/app/admin/teachers" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Teachers</span>
            </NavLink>
            <NavLink to="/app/admin/courses" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Courses</span>
            </NavLink>
            <NavLink to="/app/admin/students" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Students</span>
            </NavLink>
            <NavLink to="/app/admin/payments" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Payments Ledger</span>
            </NavLink>
            <NavLink to="/app/admin/settings" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Platform Settings</span>
            </NavLink>
          </nav>
        )}

        {/* Teacher Navigation */}
        {isTeacher && (
          <nav className="space-y-1">
            <NavLink to="/app/teacher" end className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Teacher Studio</span>
            </NavLink>
            <NavLink to="/app/teacher/courses" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>My Courses</span>
            </NavLink>
            <NavLink to="/app/teacher/students" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Enrolled Students</span>
            </NavLink>
            <NavLink to="/app/teacher/profile" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Instructor Profile</span>
            </NavLink>
            <NavLink to="/app/teacher/earnings" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Earnings & Payouts</span>
            </NavLink>
          </nav>
        )}

        {/* Student Navigation */}
        {isStudent && (
          <nav className="space-y-1">
            <NavLink to="/app/student" end className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>My Learning</span>
            </NavLink>
            <NavLink to="/app/student/settings" className={navLinkClasses} onClick={onClose}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Devices & Settings</span>
            </NavLink>
            <Link
              to="/app/courses"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-neutral-600 hover:text-[#CA8A04] hover:bg-neutral-100 transition min-h-[44px]"
              onClick={onClose}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Explore Courses</span>
            </Link>
          </nav>
        )}
      </div>

      {/* Brand Watermark / Version */}
      <div className="pt-4 border-t border-neutral-200/80 text-xs text-neutral-400">
        <p className="font-bold text-neutral-700">EDUviber</p>
        <p className="text-[11px] text-neutral-400">Commercial Learning Platform</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed / Sticky on Left) */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-neutral-200/80 bg-white p-4 flex-col justify-between min-h-[calc(100vh-4rem)]">
        {navContent}
      </aside>

      {/* Mobile Off-Canvas Slide Drawer (<768px) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

          {/* Drawer content */}
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full p-5 shadow-2xl flex flex-col justify-between transform transition-transform duration-200 ease-in-out">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-sm font-black tracking-tight text-black">
                EDU<span className="text-[#CA8A04]">viber</span> Menu
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="p-2 -mr-2 rounded-xl text-neutral-500 hover:text-black hover:bg-neutral-100 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-3">
              {navContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
