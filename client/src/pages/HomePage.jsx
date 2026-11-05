import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "../components/RoleBadge.jsx";

export default function HomePage() {
  const { user, isAuthenticated, role, isSuperAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Phase 3.1: React + Vite Frontend Foundation Active
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Next-Generation Learning, <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Unified & Modular.
            </span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed max-w-2xl">
            Welcome to the new EduVibe React application. This phase introduces modern single-page architecture while seamlessly interoperating with the existing Express backend, session authentication, CSRF protection, and EJS course platform.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 items-center">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to={isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2"
                >
                  <span>Go to My Dashboard</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
                  <span className="text-slate-400">Signed in as:</span>
                  <span className="font-semibold text-slate-200">{user.name}</span>
                  <RoleBadge role={role} />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/app/login"
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all"
                >
                  Sign In to React Portal
                </Link>
                <a
                  href="/courses"
                  className="px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2"
                >
                  <span>Browse Courses</span>
                  <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">EJS</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Architecture Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>Role Architecture & Portals</span>
          <span className="text-xs font-normal text-slate-400">— Phase 3.1 Placeholders</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Super Admin Card */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 rounded-xl p-6 transition-all space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Super Admin</span>
                <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">
                  /app/admin/*
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">Super Admin Console</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Platform-wide governance, teacher approval pipeline, system audit logs, and 20% platform commission monitoring.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80">
              <Link
                to="/app/admin"
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5"
              >
                <span>Launch Admin Console</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Teacher Card */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl p-6 transition-all space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Instructor</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
                  /app/teacher/*
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">Teacher Studio</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Multi-teacher course authoring, Bunny Stream video uploads, enrollment tracking, and instructor revenue analytics.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80">
              <Link
                to="/app/teacher"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
              >
                <span>Open Teacher Studio</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Student Card */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-6 transition-all space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Student</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
                  /app/student/*
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">Student Portal</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Course viewing, tokenized secure playback, progress checkpoints, and order history.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80">
              <Link
                to="/app/student"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
              >
                <span>Go to Student Portal</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Status Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Architecture Verification Matrix</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <p className="text-slate-500">Frontend Stack</p>
            <p className="font-semibold text-slate-200 mt-0.5">React + Vite + Tailwind</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <p className="text-slate-500">Backend API</p>
            <p className="font-semibold text-slate-200 mt-0.5">Express REST + Sessions</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <p className="text-slate-500">CSRF Protection</p>
            <p className="font-semibold text-slate-200 mt-0.5">x-csrf-token Header</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <p className="text-slate-500">Legacy EJS App</p>
            <p className="font-semibold text-emerald-400 mt-0.5">100% Preserved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
