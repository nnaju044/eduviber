import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import RoleBadge from "../components/RoleBadge.jsx";

export default function UnauthorizedPage() {
  const { user, role, isAuthenticated, isSuperAdmin, isTeacher, isStudent } = useAuth();
  const location = useLocation();

  let appropriateDashboard = "/app";
  if (isSuperAdmin) appropriateDashboard = "/app/admin";
  else if (isTeacher) appropriateDashboard = "/app/teacher";
  else if (isStudent) appropriateDashboard = "/app/student";

  return (
    <div className="max-w-xl mx-auto my-16 text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-3xl font-extrabold">
        403
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Access Restricted</h1>
        <p className="text-sm text-slate-300">
          You do not possess the required platform permissions to access this route.
        </p>
      </div>

      {isAuthenticated && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left max-w-sm mx-auto space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Authenticated as:</span>
            <span className="font-semibold text-slate-200">{user?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Your Current Role:</span>
            <RoleBadge role={role} />
          </div>
          {location.state?.requiredRoles && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-400">Required Role:</span>
              <span className="font-mono text-[11px] text-amber-400">
                {location.state.requiredRoles.join(" or ")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {isAuthenticated ? (
          <Link
            to={appropriateDashboard}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Go to Your Authorized Dashboard
          </Link>
        ) : (
          <Link
            to="/app/login"
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Sign In with an Authorized Account
          </Link>
        )}
        <Link
          to="/app"
          className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
