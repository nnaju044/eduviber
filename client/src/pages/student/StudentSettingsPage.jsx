import React from "react";
import StudentDeviceManager from "../../components/student/StudentDeviceManager.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import RoleBadge from "../../components/RoleBadge.jsx";

/**
 * StudentSettingsPage
 * Account settings for students including device registration management.
 */
export default function StudentSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900">
            Account & Device Settings
          </h1>
          <RoleBadge role="student" />
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Manage your personal profile and registered streaming devices for your student account.
        </p>
      </div>

      {/* Profile Overview */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
          Student Profile
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-neutral-400 block">Full Name</span>
            <span className="text-neutral-900 font-semibold">{user?.name || "Student"}</span>
          </div>
          <div>
            <span className="text-neutral-400 block">Email Address</span>
            <span className="text-neutral-900 font-semibold">{user?.email || "—"}</span>
          </div>
        </div>
      </div>

      {/* Device Management Section */}
      <StudentDeviceManager />
    </div>
  );
}

