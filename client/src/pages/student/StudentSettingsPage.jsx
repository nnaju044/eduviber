import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import studentApi from "../../api/studentApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import RoleBadge from "../../components/RoleBadge.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import StudentDeviceManager from "../../components/student/StudentDeviceManager.jsx";

/**
 * StudentSettingsPage (E13 Unified Student Account Portal)
 * Complete implementation of F01 (Profile), F02 (Password), F03 (Settings & Devices)
 * Designed with EduVibe brand colours: White (#FFF), Black (#000), Gold (#CA8A04)
 */
export default function StudentSettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active section tab: 'profile' | 'security' | 'devices' | 'account'
  const [activeTab, setActiveTab] = useState("profile");

  // Profile state
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [profileErrorMsg, setProfileErrorMsg] = useState("");

  // Avatar upload state
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarErrorMsg, setAvatarErrorMsg] = useState("");
  const [avatarSuccessMsg, setAvatarSuccessMsg] = useState("");

  // Email change state
  const [newEmailInput, setNewEmailInput] = useState("");
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [emailChangeMsg, setEmailChangeMsg] = useState("");
  const [emailChangeError, setEmailChangeError] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailVerifyMsg, setEmailVerifyMsg] = useState("");
  const [emailVerifyError, setEmailVerifyError] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Fetch full student profile
  const loadProfile = async () => {
    try {
      setLoadingProfile(true);
      const data = await studentApi.getProfile();
      if (data) {
        setProfile(data);
        setNameInput(data.name || "");
        setPhoneInput(data.phone || "");
      }
    } catch (err) {
      setProfileErrorMsg(err.message || "Failed to load profile.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Handle email verification token from URL query params: ?verifyEmailToken=...
  useEffect(() => {
    const token = searchParams.get("verifyEmailToken");
    if (token) {
      const runVerification = async () => {
        try {
          setVerifyingEmail(true);
          setEmailVerifyError("");
          setEmailVerifyMsg("");
          const res = await studentApi.verifyEmailChange(token);
          setEmailVerifyMsg(res?.message || "Email address verified and updated successfully!");
          await loadProfile();
          await refreshUser?.();
        } catch (err) {
          setEmailVerifyError(err.message || "Email verification failed or token expired.");
        } finally {
          setVerifyingEmail(false);
          // Remove token from URL parameters
          searchParams.delete("verifyEmailToken");
          setSearchParams(searchParams, { replace: true });
        }
      };
      runVerification();
    }
  }, [searchParams, setSearchParams, refreshUser]);

  // Handle Profile Update (Name & Phone)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg("");
    setProfileErrorMsg("");

    try {
      const updated = await studentApi.updateProfile({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
      });
      setProfile((prev) => ({ ...prev, ...updated }));
      setProfileSuccessMsg("Profile details saved successfully.");
      await refreshUser?.();
    } catch (err) {
      setProfileErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Avatar Selection & Upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size on client (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarErrorMsg("Selected image exceeds 5 MB. Please select a smaller file.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarErrorMsg("");
    setAvatarSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await studentApi.uploadAvatar(formData);
      if (res?.profilePictureUrl) {
        setProfile((prev) => ({
          ...prev,
          profilePictureUrl: res.profilePictureUrl,
          avatarVersion: res.avatarVersion,
        }));
        setAvatarSuccessMsg("Profile picture updated successfully.");
      }
    } catch (err) {
      setAvatarErrorMsg(err.message || "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Avatar Removal
  const handleDeleteAvatar = async () => {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;

    setUploadingAvatar(true);
    setAvatarErrorMsg("");
    setAvatarSuccessMsg("");

    try {
      await studentApi.deleteAvatar();
      setProfile((prev) => ({
        ...prev,
        profilePictureUrl: null,
        avatarVersion: 0,
      }));
      setAvatarSuccessMsg("Profile picture removed successfully.");
    } catch (err) {
      setAvatarErrorMsg(err.message || "Failed to remove profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Request Email Change
  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    if (!newEmailInput.trim()) return;

    setRequestingEmailChange(true);
    setEmailChangeMsg("");
    setEmailChangeError("");

    try {
      const res = await studentApi.requestEmailChange(newEmailInput.trim());
      setEmailChangeMsg(res?.message || "Verification email sent. Please check your inbox to confirm.");
      setProfile((prev) => ({ ...prev, pendingEmail: newEmailInput.trim().toLowerCase() }));
      setNewEmailInput("");
    } catch (err) {
      setEmailChangeError(err.message || "Failed to request email change.");
    } finally {
      setRequestingEmailChange(false);
    }
  };

  // Handle Password Change (F02)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordError("");

    if (!newPassword || newPassword.length < 12) {
      setPasswordError("New password must be at least 12 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      await studentApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordMsg("Password changed successfully. All devices signed out. Redirecting to login...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Global session invalidation logged out all devices. Redirect after 2 seconds.
      setTimeout(() => {
        navigate("/app/login");
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password. Please check your current password.");
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle User Logout
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to sign out of your account?")) {
      await logout();
      navigate("/app/login");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                Account Settings
              </h1>
              <RoleBadge role="student" />
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Manage your personal student profile, security, and registered streaming devices.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="self-start sm:self-center px-3.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Global Email Verification Status Alerts */}
      {verifyingEmail && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <LoadingSpinner size="sm" text="Verifying your new email address..." />
        </div>
      )}
      {emailVerifyMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
          ✓ {emailVerifyMsg}
        </div>
      )}
      {emailVerifyError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          ✕ {emailVerifyError}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 gap-1 overflow-x-auto text-xs font-bold">
        {[
          { id: "profile", label: "My Profile", icon: "👤" },
          { id: "security", label: "Security & Password", icon: "🔒" },
          { id: "devices", label: "My Devices", icon: "📱" },
          { id: "account", label: "Account Info", icon: "ℹ️" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                ? "border-amber-500 text-neutral-900 bg-amber-500/5"
                : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loadingProfile ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner text="Loading account details..." />
        </div>
      ) : (
        <>
          {/* TAB 1: MY PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Profile Avatar Card */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Profile Picture
                </h2>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="relative group shrink-0">
                    {profile?.profilePictureUrl ? (
                      <img
                        src={profile.profilePictureUrl}
                        alt={profile.name || "Student Avatar"}
                        className="w-24 h-24 rounded-full object-cover border-2 border-amber-500 shadow-sm"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center text-neutral-400">
                        <span className="text-3xl">👤</span>
                        <span className="text-[10px] font-bold mt-1 text-neutral-500">No Avatar</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-xs text-neutral-600">
                      Upload a square JPG, PNG, or WebP photo (maximum 5 MB).
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarFileChange}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-2xs disabled:opacity-50"
                      >
                        {uploadingAvatar ? "Uploading..." : profile?.profilePictureUrl ? "Replace Photo" : "Upload Photo"}
                      </button>

                      {profile?.profilePictureUrl && (
                        <button
                          type="button"
                          onClick={handleDeleteAvatar}
                          disabled={uploadingAvatar}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {avatarSuccessMsg && (
                      <p className="text-xs font-semibold text-emerald-600 pt-1">✓ {avatarSuccessMsg}</p>
                    )}
                    {avatarErrorMsg && (
                      <p className="text-xs font-semibold text-red-600 pt-1">✕ {avatarErrorMsg}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Details Form */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Personal Information
                </h2>

                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      required
                      minLength={2}
                      maxLength={70}
                      className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                    />
                    <span className="text-[11px] text-neutral-400 mt-1 block">
                      Used for enrollment notifications and SMS alerts.
                    </span>
                  </div>

                  {profileSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                      ✓ {profileSuccessMsg}
                    </div>
                  )}
                  {profileErrorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600">
                      ✕ {profileErrorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-black hover:bg-neutral-800 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {savingProfile ? "Saving Details..." : "Save Changes"}
                  </button>
                </form>
              </div>

              {/* Email Address & Verification Section */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Email Address & Verification
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    Active Login
                  </span>
                </div>

                <div className="text-xs text-neutral-600 space-y-1">
                  <p>
                    Current registered email: <strong className="text-neutral-900">{profile?.email}</strong>
                  </p>
                  {profile?.pendingEmail && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                      <strong>Pending Email Verification:</strong> A confirmation link was sent to{" "}
                      <strong>{profile.pendingEmail}</strong>. Your login email will not change until you verify that link.
                    </div>
                  )}
                </div>

                <form onSubmit={handleRequestEmailChange} className="space-y-3 max-w-lg pt-2 border-t border-neutral-100">
                  <label className="block text-xs font-bold text-neutral-700">
                    Request New Email Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      placeholder="new.email@example.com"
                      required
                      className="flex-1 px-3.5 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                    />
                    <button
                      type="submit"
                      disabled={requestingEmailChange}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-2xs disabled:opacity-50 shrink-0"
                    >
                      {requestingEmailChange ? "Sending..." : "Send Verification"}
                    </button>
                  </div>

                  {emailChangeMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                      ✓ {emailChangeMsg}
                    </div>
                  )}
                  {emailChangeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600">
                      ✕ {emailChangeError}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h2 className="text-sm font-bold text-neutral-900">
                    Change Password
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    For your security, changing your password will immediately sign out all active sessions across all devices and browsers.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Current Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 pr-10 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-xs"
                      >
                        {showCurrentPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      New Password (Min 12 characters) *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={12}
                        className="w-full px-3.5 py-2 pr-10 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-xs"
                      >
                        {showNewPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Confirm New Password *
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={12}
                      className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white text-neutral-900"
                    />
                  </div>

                  {passwordMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                      ✓ {passwordMsg}
                    </div>
                  )}
                  {passwordError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600">
                      ✕ {passwordError}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-black hover:bg-neutral-800 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      {changingPassword ? "Updating Password..." : "Update Password & Sign Out Everywhere"}
                    </button>
                  </div>
                </form>

                <div className="border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                  <p>
                    Forgot your current password? You can request a reset link at any time from the{" "}
                    <a href="/forgot-password" className="text-amber-600 underline font-semibold">
                      Password Recovery Page
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MY DEVICES */}
          {activeTab === "devices" && (
            <div className="space-y-6">
              <StudentDeviceManager />
            </div>
          )}

          {/* TAB 4: ACCOUNT INFORMATION */}
          {activeTab === "account" && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Account Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5">Canonical Student ID (MongoDB ObjectId)</span>
                  <span className="text-neutral-900 font-mono font-bold text-xs">
                    {profile?.id || user?.id || "—"}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5">Account Role</span>
                  <span className="text-neutral-900 font-bold capitalize">
                    {profile?.role || user?.role || "Student"}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5">Registered Email</span>
                  <span className="text-neutral-900 font-semibold">
                    {profile?.email || user?.email || "—"}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5">Account Created</span>
                  <span className="text-neutral-900 font-semibold">
                    {profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Session Management</h3>
                  <p className="text-[11px] text-neutral-500">Sign out of your account on this device</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
