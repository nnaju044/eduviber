import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "../components/RoleBadge.jsx";
import GlyphPortal from "../components/GlyphPortal.jsx";
import HeroDoodleOverlay from "../components/HeroDoodleOverlay.jsx";

function HeroContentLayer({
  isDark = false,
  isAuthenticated,
  isSuperAdmin,
  isTeacher,
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 space-y-6 text-center sm:text-left select-none">
      <div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${isDark
            ? "bg-white/10 text-white border border-white/20"
            : "bg-black/5 text-neutral-900 border border-neutral-200"
            }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#CA8A04]" />
          Interactive Learning Platform
        </span>
      </div>
      <h2
        className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] ${isDark ? "text-white" : "text-black"
          }`}
      >
        Master Practical Digital Skills.
      </h2>
      <p
        className={`text-base sm:text-lg font-medium leading-relaxed max-w-xl ${isDark ? "text-neutral-300" : "text-neutral-700"
          }`}
      >
        Step through live course video lessons, complete assignments, manage
        curriculum content access, and learn at your own pace.
      </p>
      <div className="pt-2 flex flex-wrap gap-3.5 items-center justify-center sm:justify-start">
        <a
          href="/courses"
          tabIndex={isDark ? -1 : 0}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] flex items-center shadow-sm ${isDark
            ? "bg-white hover:bg-neutral-100 text-black active:scale-[0.99]"
            : "bg-black hover:bg-neutral-800 text-white active:scale-[0.99]"
            }`}
        >
          Browse All Courses
        </a>
        {isAuthenticated ? (
          <Link
            to={isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"}
            tabIndex={isDark ? -1 : 0}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] flex items-center ${isDark
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              : "bg-white hover:bg-neutral-50 text-black border border-neutral-200 shadow-sm"
              }`}
          >
            Go to Dashboard →
          </Link>
        ) : (
          <Link
            to="/app/login"
            tabIndex={isDark ? -1 : 0}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] flex items-center ${isDark
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              : "bg-white hover:bg-neutral-50 text-black border border-neutral-200 shadow-sm"
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

  // Random focus letter from valid EDUVIBER characters, consistent per page session
  const randomFocusChar = useMemo(() => {
    const letters = ["E", "D", "U", "V", "I", "B", "R"];
    return letters[Math.floor(Math.random() * letters.length)];
  }, []);

  return (
    <div className="space-y-20 pb-16">
      {/* Scroll-Driven GlyphPortal Experience */}
      <div className="w-full bg-white relative">
        <GlyphPortal
          word="EDUVIBER"
          focusChar={randomFocusChar}
          interactive={false}
          scrollLength={2.6}
          fontWeight={900}
          showHint={false}
          enterLabel=""
          front={<HeroDoodleOverlay />}
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

      {/* Platform & Curriculum Overview */}
      <section className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-baseline pt-4 border-t border-neutral-200/80">
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04]">
              Structured Learning Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-snug">
              Every course built for measurable digital proficiency.
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed font-medium">
              Self-paced curriculum delivered through high-bitrate video lessons, progress-synced checkpoints, and direct instructor assessments.
            </p>
            <div className="pt-2">
              <a
                href="/courses"
                className="inline-flex items-center gap-2 text-sm font-bold text-black hover:text-[#CA8A04] transition-colors"
              >
                <span>Explore the full course catalog</span>
                <span className="text-[#CA8A04]">→</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-2">
              <span className="text-sm font-bold text-neutral-900 block tracking-tight">
                Focused Video Lessons
              </span>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                High-definition, distraction-free video playback designed for focused learning on any device.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-neutral-900 block tracking-tight">
                Pick Up Where You Left Off
              </span>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Your progress is saved automatically, so you can return to where you left off.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-neutral-900 block tracking-tight">
                Guided Learning &amp; Feedback
              </span>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                Step-by-step module milestones with homework submissions reviewed directly by your instructors.
              </p>
            </div>
          </div>
        </div>

        {/* Authenticated Fast-Switch Ribbon if logged in */}
        {isAuthenticated && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-neutral-100/70 border border-neutral-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-neutral-500">Signed in:</span>
              <span className="text-xs font-bold text-black">{user?.name}</span>
              <RoleBadge role={role} />
            </div>
            <Link
              to={isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"}
              className="text-xs font-bold text-black hover:text-[#CA8A04] flex items-center gap-1.5 transition-colors"
            >
              <span>Continue to your dashboard</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </section>

      {/* Role Portals Grid */}
      <section className="space-y-8 pt-4 border-t border-neutral-200/80">
        <div className="max-w-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04] block mb-1">
            Dedicated Workspaces
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Learning Portals
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-1 leading-relaxed">
            Tailored workspaces engineered for every participant across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {/* Student Portal */}
          <div className="group flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-neutral-50/60 border border-neutral-200/90 hover:border-black/30 hover:bg-neutral-50 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                  Learners
                </span>
                <span className="text-xs font-semibold text-neutral-400">
                  01
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                  Student Portal
                </h3>
                <p className="text-xs text-neutral-600 font-medium mt-2 leading-relaxed">
                  Access enrolled video lessons, pick up where you left off, submit homework assignments, and track your completion milestones.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-neutral-200/70">
              <Link
                to="/app/student"
                className="inline-flex items-center gap-2 text-xs font-bold text-black group-hover:text-[#CA8A04] transition-colors min-h-[44px]"
              >
                <span>Enter Student Portal</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>

          {/* Teacher Portal */}
          <div className="group flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-neutral-50/60 border border-neutral-200/90 hover:border-[#CA8A04]/50 hover:bg-neutral-50 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#CA8A04]">
                  Instructors
                </span>
                <span className="text-xs font-semibold text-neutral-400">
                  02
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                  Teacher Studio
                </h3>
                <p className="text-xs text-neutral-600 font-medium mt-2 leading-relaxed">
                  Upload lesson materials, review student homework submissions, organize course modules, and manage student enrollments.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-neutral-200/70">
              <Link
                to="/app/teacher"
                className="inline-flex items-center gap-2 text-xs font-bold text-black group-hover:text-[#CA8A04] transition-colors min-h-[44px]"
              >
                <span>Open Teacher Studio</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
