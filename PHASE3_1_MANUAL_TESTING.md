# EduVibe — Phase 3.1: React Frontend Foundation Manual Testing Guide

This guide is designed for non-technical users and QA testers to verify the Phase 3.1 React + Vite frontend foundation. It demonstrates how the canonical React single-page application (SPA) functions under `/app/*`, how session-backed authentication and CSRF protection work, how role-based routing restricts unauthorized users, and how the existing EJS views and REST APIs continue to operate without interference.

---

## 1. Prerequisites & Starting the Application

### Option A: Running Express in Full-Stack Mode (Serves React Build + EJS)

1. Open your terminal in the project root:
   ```bash
   cd "/Users/jeebs/Library/Mobile Documents/com~apple~CloudDocs/EDUviber"
   ```
2. Build the React frontend:
   ```bash
   npm run client:build
   ```
3. Start the Express server:
   ```bash
   npm start
   ```
4. Express will listen at: **`http://localhost:2000`**

### Option B: Running the Vite React Development Server (Hot Reloading)

1. Start Express on port 2000 in one terminal:
   ```bash
   npm start
   ```
2. Start the Vite React development server in a second terminal:
   ```bash
   npm run client:dev
   ```
3. Vite will serve the React app at: **`http://localhost:5173`** (API requests are automatically proxied to Express on port 2000).

---

## 2. Test User Accounts (Reference)

For manual testing, you can use the accounts created during the migration or seed a test user:

| Role | Email | Password | Approval Status | Primary Portal |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@example.com` | `Admin123!` | N/A | `/app/admin` |
| **Teacher (Approved)** | `teacher.approved@example.com` | `Teacher123!` | Approved (`isApproved: true`) | `/app/teacher` |
| **Teacher (Pending)** | `teacher.pending@example.com` | `Teacher123!` | Pending (`isApproved: false`) | `/app/teacher` (Shows banner) |
| **Student** | `student@example.com` | `Student123!` | N/A | `/app/student` |

---

## 3. Canonical React Destinations (`/app/*`)

The React application is mounted under the canonical prefix `/app/*` to ensure zero collision with existing Express EJS routes.

### Test 1: React Portal Landing Page & Brand Aesthetics
- **Starting URL**: `http://localhost:2000/app` (or `http://localhost:5173/app`)
- **Account**: Unauthenticated (no login required)
- **Actions to Perform**:
  1. Open `http://localhost:2000/app` in your browser.
  2. Observe the page header, logo, and navigation links.
- **Expected Result**:
  - The page displays the dark slate/black background (`#0B0F19`) with amber/gold accents.
  - The top navigation bar displays the EDUviber logo, a gold **React** badge, and links to **Home**, **Courses (EJS)**, and **Sign In**.
  - A hero section announces *"Phase 3.1: React + Vite Frontend Foundation Active"*.
  - Three role cards appear for Super Admin (`/app/admin/*`), Instructor (`/app/teacher/*`), and Student (`/app/student/*`).
- **How to Identify Failure**:
  - A blank white page, broken styling, or missing logo indicates that static assets failed to load.

---

### Test 2: React Sign-In via Session Cookie + CSRF
- **Starting URL**: `http://localhost:2000/app/login` (or `http://localhost:5173/app/login`)
- **Account**: Super Admin (`admin@example.com` / `Admin123!`)
- **Actions to Perform**:
  1. Open `http://localhost:2000/app/login`.
  2. Enter the Super Admin email: `admin@example.com`.
  3. Enter the password: `Admin123!`.
  4. Click the **"Show"** button inside the password field to toggle password visibility.
  5. Click **"Sign In"**.
- **Expected Result**:
  - The submit button briefly displays a spinner saying *"Authenticating..."*.
  - The API call `POST /api/auth/login` succeeds with HTTP 200, setting the session cookie `course.sid`.
  - The browser automatically redirects to the Super Admin Console at **`http://localhost:2000/app/admin`**.
  - The navigation bar updates to display the Super Admin's name, email, and purple **Super Admin** badge.
- **How to Identify Failure**:
  - A red error banner appears saying *"Invalid or missing CSRF token"* (CSRF negotiation failure).
  - The page reloads back to login without updating session state.

---

### Test 3: Super Admin Console Placeholders (Phase 3.1)
- **Starting URL**: `http://localhost:2000/app/admin` (while logged in as Super Admin)
- **Account**: Super Admin
- **Actions to Perform**:
  1. Inspect the sidebar and main view.
  2. Review the four metric cards:
     - Platform Revenue: `20.0% Commission`
     - Teacher Accounts: `Pending Queue`
     - Total Courses: `Catalog Active`
     - System Security: `CSRF & Sessions`
  3. Note the two marked placeholder panels: *"Teacher Approvals Pipeline (Placeholder)"* and *"Platform Financial Audits (Placeholder)"*.
  4. Click the link in the top right: **"Open EJS Admin ↗"**.
- **Expected Result**:
  - The placeholder sections clearly state that interactive approvals and payout controls will be added in Phase 3.2.
  - Clicking "Open EJS Admin" navigates to the existing EJS admin panel (`/admin/courses`).
- **How to Identify Failure**:
  - Broken layout or 404 error when clicking navigation links.

---

### Test 4: Teacher Studio & Dynamic Revenue Share
- **Starting URL**: `http://localhost:2000/app/teacher` (or `http://localhost:5173/app/teacher`)
- **Account**: Teacher account (e.g. `teacher.pending@example.com` or `teacher.approved@example.com`)
- **Actions to Perform**:
  1. Log in with a teacher account.
  2. Navigate to `http://localhost:2000/app/teacher`.
- **Expected Result**:
  - If approved: Displays an emerald **"Approved Instructor"** badge.
  - If pending: Displays an amber **"Pending Approval"** badge and an alert banner:
    *"Instructor Account Under Review — Your instructor profile is currently awaiting validation by the platform Super Admin. Full course publication and payout capabilities will activate automatically upon approval."*
  - The **"Teacher Net Split"** card dynamically derives and displays the instructor's actual net share from their profile (e.g. `80.0% Revenue` when commission rate is `0.20`, or labelled platform standard).
  - "Published Courses" and "Active Students" cards clearly display placeholder indicators (`—`) rather than invented mock numbers.
- **How to Identify Failure**:
  - The warning banner does not appear for an unapproved instructor, or an approved instructor incorrectly sees the warning banner.

---

### Test 5: Role-Based Route Protection (Unauthorized Access)
- **Starting URL**: `http://localhost:2000/app/admin` (or `http://localhost:5173/app/admin`)
- **Account**: Student account (`student@example.com` / `Student123!`)
- **Actions to Perform**:
  1. Log in with a Student account.
  2. Attempt to manually navigate in the browser address bar to `http://localhost:2000/app/admin`.
- **Expected Result**:
  - The application intercepts the navigation and redirects to **`http://localhost:2000/app/unauthorized`**.
  - The page displays a stylized **HTTP 403 Access Restricted** view.
  - The page informs the user: *"Your Current Role: Student"*, and *"Required Role: super_admin or admin"*.
  - A prominent gold button allows the student to click: **"Go to Your Authorized Dashboard"** (which returns them to `/app/student`).
- **How to Identify Failure**:
  - The student is allowed to see the Super Admin Console or teacher settings.

---

### Test 6: Unauthenticated Access to Protected Routes
- **Starting URL**: `http://localhost:2000/app/teacher`
- **Account**: Logged out (incognito/private browser window)
- **Actions to Perform**:
  1. Open a new private/incognito browser window.
  2. Visit `http://localhost:2000/app/teacher`.
- **Expected Result**:
  - The React `ProtectedRoute` component detects no active session.
  - The browser is immediately redirected to **`http://localhost:2000/app/login`** (with redirect state preserved).
  - The user cannot view teacher studio content without authenticating.
- **How to Identify Failure**:
  - The teacher dashboard or placeholder data flashes or renders for unauthenticated visitors.

---

### Test 7: Legacy URL Redirects (`/teacher` and `/student`)
- **Starting URL**: `http://localhost:2000/teacher` and `http://localhost:2000/student`
- **Account**: Any
- **Actions to Perform**:
  1. Type `http://localhost:2000/teacher` into the browser address bar.
  2. Observe the browser network tab and address bar.
  3. Type `http://localhost:2000/student` into the browser address bar.
- **Expected Result**:
  - `http://localhost:2000/teacher` automatically issues an HTTP 302 redirect to `http://localhost:2000/app/teacher`.
  - `http://localhost:2000/student` automatically issues an HTTP 302 redirect to `http://localhost:2000/app/student`.
- **How to Identify Failure**:
  - Visiting `/teacher` or `/student` returns a 404 or fails to redirect to the canonical `/app/*` destination.

---

### Test 8: Logging Out
- **Starting URL**: Any dashboard (e.g. `http://localhost:2000/app/teacher` or `http://localhost:2000/app/admin`)
- **Account**: Any logged-in user
- **Actions to Perform**:
  1. Click the **"Log Out"** button in the top-right corner of the navigation bar.
- **Expected Result**:
  - The API call `POST /api/auth/logout` is sent with the CSRF token.
  - The backend destroys the Express session and clears the `course.sid` cookie.
  - The user is redirected to `http://localhost:2000/app/login`.
  - Refreshing the page confirms that the user is unauthenticated.
- **How to Identify Failure**:
  - The user remains logged in after clicking "Log Out".

---

## 4. Verification of Existing EJS Application (Non-Regression)

The existing EJS application must continue working exactly as before.

### Test 9: EJS Landing Page & Course Catalog
- **Starting URL**: `http://localhost:2000/` and `http://localhost:2000/courses`
- **Account**: Unauthenticated
- **Actions to Perform**:
  1. Open `http://localhost:2000/` directly in the browser.
  2. Click on **"Explore Courses"** to visit `http://localhost:2000/courses`.
- **Expected Result**:
  - The traditional EJS landing page and course catalog render completely intact.
  - Course cards, prices, and thumbnails render with existing styles.
  - The React SPA does **not** hijack `http://localhost:2000/` or `http://localhost:2000/courses`.
- **How to Identify Failure**:
  - Visiting `http://localhost:2000/courses` returns a blank React page or index.html instead of the EJS catalog.

---

### Test 10: EJS Login Page & EJS Admin Dashboard
- **Starting URL**: `http://localhost:2000/login` and `http://localhost:2000/admin`
- **Actions to Perform**:
  1. Visit `http://localhost:2000/login` directly.
  2. Visit `http://localhost:2000/admin` without being logged in.
- **Expected Result**:
  - `http://localhost:2000/login` renders the traditional EJS login view (`views/auth/login.ejs`) with the server-side CSRF hidden input `<input type="hidden" name="_csrf" ...>`.
  - `http://localhost:2000/admin` checks `requireAuth` and redirects unauthenticated users to `/login` (302).
- **How to Identify Failure**:
  - A React single-page login renders instead of the EJS template at `http://localhost:2000/login`.

---

### Test 11: API Protection & Unknown Route Handling
- **Actions to Perform**:
  1. Open your browser or use curl to test an unknown API route:
     ```bash
     curl -i http://localhost:2000/api/unknown-endpoint-test
     ```
  2. Open an unknown website route:
     ```bash
     curl -i http://localhost:2000/some-random-unknown-page
     ```
- **Expected Result**:
  - The missing API route returns **HTTP 404 with JSON** (`code: "ENDPOINT_NOT_FOUND"`), **not** index.html:
    ```json
    {
      "success": false,
      "message": "API endpoint GET /api/unknown-endpoint-test not found.",
      "code": "ENDPOINT_NOT_FOUND"
    }
    ```
  - The missing website route returns **HTTP 404 with EJS HTML** (`views/public/404.ejs`).
- **How to Identify Failure**:
  - A missing API endpoint returns HTML or index.html.

---

## 5. Summary of Phase 3.1 Placeholders

The following components are intentionally scaffolded as placeholders in Phase 3.1 and will be fully implemented in Phase 3.2:

1. **Course Management Builder**: Chapter creation, video asset management, and pricing controls (`/app/teacher/courses`).
2. **Teacher Approvals Pipeline**: Super admin interactive approve/reject buttons and applicant profile reviews (`/app/admin/teachers`).
3. **Financial Ledger & Payouts**: Automated teacher revenue split ledger and payout requests (`/app/teacher/earnings` and `/app/admin/payments`).
4. **Student Video Player**: Interactive lesson playback with dynamic watermarking and checkpoint sync in React (`/app/student`). (Students can currently view videos via the existing EJS player at `/courses`).
