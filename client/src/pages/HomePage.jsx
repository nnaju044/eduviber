import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "../components/RoleBadge.jsx";
import GlyphPortal from "../components/GlyphPortal.jsx";

function HeroContentLayer({
  isDark = false,
  isAuthenticated,
  isSuperAdmin,
  isTeacher,
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6 text-center sm:text-left select-none">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${isDark
            ? "bg-white/15 text-white border border-white/25"
            : "bg-black/10 text-black border border-black/15"
          }`}
      >
        ✦ Live Interactive Learning Platform
      </span>
      <h2
        className={`text-3xl sm:text-5xl font-black tracking-tight leading-tight ${isDark ? "text-white" : "text-black"
          }`}
      >
        Master Practical Digital Skills.
      </h2>
      <p
        className={`text-base sm:text-lg font-semibold leading-relaxed ${isDark ? "text-neutral-200" : "text-neutral-900"
          }`}
      >
        Step through live course video lessons, complete assignments, manage
        curriculum content access, and learn at your own pace.
      </p>
      <div className="pt-2 flex flex-wrap gap-4 items-center justify-center sm:justify-start">
        <a
          href="/courses"
          tabIndex={isDark ? -1 : 0}
          className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all min-h-[44px] flex items-center ${isDark
              ? "bg-white hover:bg-neutral-100 text-black"
              : "bg-black hover:bg-neutral-800 text-white"
            }`}
        >
          Browse All Courses
        </a>
        {isAuthenticated ? (
          <Link
            to={isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"}
            tabIndex={isDark ? -1 : 0}
            className={`px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all border min-h-[44px] flex items-center ${isDark
                ? "bg-white/15 hover:bg-white/25 text-white border-white/30"
                : "bg-white hover:bg-neutral-100 text-black border-neutral-300"
              }`}
          >
            Go to Dashboard →
          </Link>
        ) : (
          <Link
            to="/app/login"
            tabIndex={isDark ? -1 : 0}
            className={`px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all border min-h-[44px] flex items-center ${isDark
                ? "bg-white/15 hover:bg-white/25 text-white border-white/30"
                : "bg-white hover:bg-neutral-100 text-black border-neutral-300"
              }`}
          >
            Student Sign In
          </Link>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, isAuthenticated, role, isSuperAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div className="space-y-16 py-2">
      {/* Scroll-Driven GlyphPortal Experience */}
      <div className="rounded-3xl border border-slate-800 shadow-2xl bg-white">
        <GlyphPortal
          word="EDUVIBER"
          focusChar="V"
          interactive={true}
          scrollLength={2.6}
          fontWeight={900}
          enterLabel="Enter Platform"
        >
          <div className="relative w-full grid grid-cols-1 grid-rows-1">
            {/* Dark side (Black background): Crisp White fonts */}
            <div
              className="col-start-1 row-start-1 w-full"
              style={{
                clipPath: "polygon(0% 0%, var(--gp-brand-split, 37.5%) 0%, var(--gp-brand-split, 37.5%) 100%, 0% 100%)",
                WebkitClipPath: "polygon(0% 0%, var(--gp-brand-split, 37.5%) 0%, var(--gp-brand-split, 37.5%) 100%, 0% 100%)",
              }}
              aria-hidden="true"
            >
              <HeroContentLayer
                isDark={true}
                isAuthenticated={isAuthenticated}
                isSuperAdmin={isSuperAdmin}
                isTeacher={isTeacher}
              />
            </div>

            {/* Light side (Gold background): Crisp Black fonts */}
            <div
              className="col-start-1 row-start-1 w-full"
              style={{
                clipPath: "polygon(var(--gp-brand-split, 37.5%) 0%, 100% 0%, 100% 100%, var(--gp-brand-split, 37.5%) 100%)",
                WebkitClipPath: "polygon(var(--gp-brand-split, 37.5%) 0%, 100% 0%, 100% 100%, var(--gp-brand-split, 37.5%) 100%)",
              }}
            >
              <HeroContentLayer
                isDark={false}
                isAuthenticated={isAuthenticated}
                isSuperAdmin={isSuperAdmin}
                isTeacher={isTeacher}
              />
            </div>
          </div>
        </GlyphPortal>
      </div>

      {/* Hero Quick Navigation Section */}
      <div className="relative rounded-2xl bg-white border border-neutral-200/80 p-8 sm:p-12 shadow-card">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CA8A04]/10 border border-[#CA8A04]/20 text-[#CA8A04] text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-[#CA8A04] animate-pulse" />
            Live Education Platform • Commercial Edition
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-neutral-900 tracking-tight leading-tight">
            High-Impact Practical Skills, <br />
            <span className="text-[#CA8A04]">
              Structured for Mastery.
            </span>
          </h1>

          <p className="text-base text-neutral-600 font-medium leading-relaxed max-w-2xl">
            Step through curriculum video lessons, track your unique progress, submit assignments, and manage your student journey through a minimal, high-performance interface.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 items-center">
            {isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"}
                  className="px-6 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 min-h-[44px]"
                >
                  <span>Go to My Dashboard</span>
                  <span>→</span>
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-700 min-h-[44px]">
                  <span className="text-neutral-500">Active account:</span>
                  <span className="text-black font-bold">{user?.name}</span>
                  <RoleBadge role={role} />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/app/login"
                  className="px-6 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-sm shadow-sm transition-all min-h-[44px] flex items-center"
                >
                  Sign In to Platform
                </Link>
                <a
                  href="/courses"
                  className="px-6 py-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 font-bold text-sm border border-neutral-300 transition-all flex items-center gap-1.5 min-h-[44px]"
                >
                  <span>Browse Course Catalog</span>
                  <span className="text-[#CA8A04]">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Portals Grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">Dedicated Learning Portals</h2>
          <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-1">
            Tailored workspaces engineered for each participant across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Super Admin Card */}
          <div className="bg-white border border-neutral-200 hover:border-black rounded-2xl p-6 transition-all space-y-4 flex flex-col justify-between shadow-subtle hover:shadow-card">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-black">Administrator</span>
                <span className="text-[10px] bg-neutral-100 text-neutral-700 font-bold border border-neutral-200 px-2 py-0.5 rounded-full">
                  /app/admin
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Admin Console</h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Platform operational metrics, teacher account approvals, course catalog publication, and payments audit ledger.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100">
              <Link
                to="/app/admin"
                className="text-xs font-bold text-black hover:text-[#CA8A04] flex items-center gap-1.5 min-h-[36px]"
              >
                <span>Launch Admin Console</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Teacher Card */}
          <div className="bg-white border border-neutral-200 hover:border-black rounded-2xl p-6 transition-all space-y-4 flex flex-col justify-between shadow-subtle hover:shadow-card">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04]">Instructor</span>
                <span className="text-[10px] bg-[#CA8A04]/10 text-[#CA8A04] font-bold border border-[#CA8A04]/20 px-2 py-0.5 rounded-full">
                  /app/teacher
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Teacher Studio</h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Curriculum authoring, video lesson uploads, student enrollment, homework assignments, and granular access unlocking.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100">
              <Link
                to="/app/teacher"
                className="text-xs font-bold text-black hover:text-[#CA8A04] flex items-center gap-1.5 min-h-[36px]"
              >
                <span>Open Teacher Studio</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Student Card */}
          <div className="bg-white border border-neutral-200 hover:border-black rounded-2xl p-6 transition-all space-y-4 flex flex-col justify-between shadow-subtle hover:shadow-card">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Learner</span>
                <span className="text-[10px] bg-neutral-100 text-neutral-700 font-bold border border-neutral-200 px-2 py-0.5 rounded-full">
                  /app/student
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Student Portal</h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Tokenized secure video playback, watermark identity protection, interactive homework submissions, and learning milestones.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100">
              <Link
                to="/app/student"
                className="text-xs font-bold text-black hover:text-[#CA8A04] flex items-center gap-1.5 min-h-[36px]"
              >
                <span>Enter Student Portal</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
