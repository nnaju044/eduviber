import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth session on mount
  const checkSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch initial CSRF token and verify existing session
      await authApi.getCsrfToken();
      const res = await authApi.getMe();
      if (res && res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 just means not logged in
      if (err.status !== 401) {
        console.warn("Auth check failed:", err.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error("Invalid response from server");
    } catch (err) {
      setError(err.message || "Failed to log in");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res && res.success && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
      }
    }
    return null;
  };

  // Helper flags
  const role = user?.role || null;
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isApprovedTeacher = isTeacher && user?.teacherProfile?.isApproved === true;
  const isSuspendedTeacher = isTeacher && user?.teacherProfile?.isApproved === false;

  const value = {
    user,
    role,
    loading,
    error,
    isAuthenticated: Boolean(user),
    isSuperAdmin,
    isTeacher,
    isStudent,
    isApprovedTeacher,
    isSuspendedTeacher,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
