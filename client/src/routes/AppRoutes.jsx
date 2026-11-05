import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout.jsx";
import AuthLayout from "../layouts/AuthLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import HomePage from "../pages/HomePage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import UnauthorizedPage from "../pages/UnauthorizedPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import OverviewPage from "../pages/admin/OverviewPage.jsx";
import TeachersPage from "../pages/admin/TeachersPage.jsx";
import CoursesPage from "../pages/admin/CoursesPage.jsx";
import StudentsPage from "../pages/admin/StudentsPage.jsx";
import PaymentsPage from "../pages/admin/PaymentsPage.jsx";
import SettingsPage from "../pages/admin/SettingsPage.jsx";
import TeacherDashboard from "../pages/teacher/TeacherDashboard.jsx";
import TeacherCoursesPage from "../pages/teacher/TeacherCoursesPage.jsx";
import TeacherCourseEditorPage from "../pages/teacher/TeacherCourseEditorPage.jsx";
import TeacherStudentsPage from "../pages/teacher/TeacherStudentsPage.jsx";
import TeacherProfilePage from "../pages/teacher/TeacherProfilePage.jsx";
import TeacherEarningsPage from "../pages/teacher/TeacherEarningsPage.jsx";
import StudentDashboard from "../pages/student/StudentDashboard.jsx";
import StudentSettingsPage from "../pages/student/StudentSettingsPage.jsx";
import CourseLearningPage from "../pages/student/CourseLearningPage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

function DashboardRedirect() {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Redirecting to your dashboard..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/app/login" replace />;
  }

  if (role === "super_admin" || role === "admin") return <Navigate to="/app/admin" replace />;
  if (role === "teacher") return <Navigate to="/app/teacher" replace />;
  if (role === "student") return <Navigate to="/app/student" replace />;

  return <Navigate to="/app" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Compatibility aliases redirecting to canonical /app/* paths */}
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Navigate to="/app/login" replace />} />
      <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
      <Route path="/admin/*" element={<Navigate to="/app/admin" replace />} />
      <Route path="/teacher" element={<Navigate to="/app/teacher" replace />} />
      <Route path="/teacher/*" element={<Navigate to="/app/teacher" replace />} />
      <Route path="/student" element={<Navigate to="/app/student" replace />} />
      <Route path="/student/*" element={<Navigate to="/app/student" replace />} />
      <Route path="/unauthorized" element={<Navigate to="/app/unauthorized" replace />} />

      {/* Canonical React Public & General Pages */}
      <Route element={<AppLayout showSidebar={false} />}>
        <Route path="/app" element={<HomePage />} />
        <Route path="/app/unauthorized" element={<UnauthorizedPage />} />
      </Route>

      {/* Canonical React Auth Layout */}
      <Route element={<AuthLayout />}>
        <Route path="/app/login" element={<LoginPage />} />
      </Route>

      {/* Canonical React Role-Specific Protected Dashboards with Sidebar */}
      <Route element={<AppLayout showSidebar={true} />}>
        {/* Smart App redirects */}
        <Route path="/app/dashboard" element={<DashboardRedirect />} />

        {/* Super Admin Area */}
        <Route
          path="/app/admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <OverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/teachers"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <TeachersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/courses"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <CoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/students"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/payments"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Teacher Studio */}
        <Route
          path="/app/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher/courses"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherCoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher/courses/:id"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherCourseEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher/students"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherStudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher/profile"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher/earnings"
          element={
            <ProtectedRoute allowedRoles={["teacher", "super_admin", "admin"]}>
              <TeacherEarningsPage />
            </ProtectedRoute>
          }
        />

        {/* Student Learning Portal */}
        <Route
          path="/app/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/student/settings"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/student/courses/:courseId"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <CourseLearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/student/*"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Catch-All */}
      <Route element={<AppLayout showSidebar={false} />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
