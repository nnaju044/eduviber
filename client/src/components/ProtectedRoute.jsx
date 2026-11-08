import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requireApprovedTeacher = false,
}) {
  const { user, role, loading, isAuthenticated, isTeacher } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Checking authentication status..." />
      </div>
    );
  }

  // 1. Must be logged in
  if (!isAuthenticated || !user) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  // 2. Normalize roles
  const normalizedUserRole = role === "admin" ? "super_admin" : role;
  const normalizedAllowed = allowedRoles.map((r) => (r === "admin" ? "super_admin" : r));

  // 3. Role check
  if (allowedRoles.length > 0 && !normalizedAllowed.includes(normalizedUserRole)) {
    return <Navigate to="/app/unauthorized" state={{ attemptedRole: role, requiredRoles: allowedRoles }} replace />;
  }

  // 4. Teacher approval check if specified
  if (requireApprovedTeacher && isTeacher) {
    const isApproved = user?.teacherProfile?.isApproved === true;
    if (!isApproved) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-6 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-amber-300">Teacher Account Pending Approval</h2>
          <p className="text-sm text-slate-300">
            Your instructor account is currently undergoing administrator verification. You cannot perform restricted course creation or payout operations until approved by a Super Admin.
          </p>
          <p className="text-xs text-slate-400">
            Current Status: <span className="font-semibold text-amber-400">Pending Review</span>
          </p>
        </div>
      );
    }
  }

  return children;
}
