import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function NotFoundPage() {
  const { isAuthenticated, isSuperAdmin, isTeacher, isStudent } = useAuth();

  let dashboardHref = "/app";
  if (isSuperAdmin) dashboardHref = "/app/admin";
  else if (isTeacher) dashboardHref = "/app/teacher";
  else if (isStudent) dashboardHref = "/app/student";

  return (
    <div className="max-w-md mx-auto my-16 text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center text-3xl font-extrabold">
        404
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Page Not Found</h1>
        <p className="text-sm text-slate-400">
          The view or route you requested does not exist in the EduVibe frontend application.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/app"
          className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
        >
          Return Home
        </Link>
        {isAuthenticated && (
          <Link
            to={dashboardHref}
            className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all"
          >
            My Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
