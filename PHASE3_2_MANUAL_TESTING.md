# EduVibe — Phase 3.2: Super Admin Dashboard Manual Testing Guide

This guide provides step-by-step procedures to manually verify all features of the **Super Admin Dashboard** in the React application (`/app/admin`), including live platform metrics, teacher onboarding and management, course catalog governance, student dossier inspection, manual payment review, and CSRF/role authorization safeguards.

---

## 1. Prerequisites & Environment Setup

### 1.1 Start the Server
In your terminal, run the application:
```bash
# Ensure dependencies are installed and client is built
npm run client:build

# Launch the development server (runs on port 2000 by default)
npm run dev
```

### 1.2 Access URLs
- **React Login:** `http://localhost:2000/app/login`
- **Super Admin Overview:** `http://localhost:2000/app/admin`
- **Teacher Management:** `http://localhost:2000/app/admin/teachers`
- **Course Catalog Governance:** `http://localhost:2000/app/admin/courses`
- **Student Directory:** `http://localhost:2000/app/admin/students`
- **Payments & Settlements:** `http://localhost:2000/app/admin/payments`
- **Platform Settings (Placeholder):** `http://localhost:2000/app/admin/settings`

### 1.3 Super Admin Credentials
If you need to seed or verify a Super Admin user, check `.env` or use the existing super admin account:
- **Email:** `admin@example.com` (or your configured admin account)
- **Password:** `AdminPassword123!` (or your configured password)
*(Alternatively, create an isolated admin via `node scripts/createAdmin.js`)*

---

## 2. Feature 1: Super Admin Access & Role-Based Routing

### Objective
Verify that Super Admin can access the console, while unauthenticated or non-admin users are strictly denied.

### Positive Test: Super Admin Login
1. Navigate to `http://localhost:2000/app/login`.
2. Enter the Super Admin credentials.
3. Click **"Sign In"**.
4. **Expected Result:**
   - Redirects to `http://localhost:2000/app/admin`.
   - Sidebar displays **"SUPER ADMIN CONSOLE"** with links: *Overview*, *Teachers*, *Courses*, *Students*, *Payments*, *Settings*, and *Legacy EJS Admin*.
   - Navbar displays the user's name and a gold **"SUPER ADMIN"** badge.

### Negative Test 1: Anonymous Access
1. Open an Incognito/Private window.
2. Navigate directly to `http://localhost:2000/app/admin`.
3. **Expected Result:**
   - Client redirects immediately to `http://localhost:2000/app/login`.
   - Admin UI is never rendered.

### Negative Test 2: Student / Teacher Unauthorized Access
1. In the incognito window, log in with a student or teacher account.
2. Attempt to navigate to `http://localhost:2000/app/admin`.
3. **Expected Result:**
   - Redirects to `http://localhost:2000/app/unauthorized` or their respective portal (`/app/student` or `/app/teacher`).
   - Direct API request to `http://localhost:2000/api/admin/stats` returns HTTP `403 Forbidden` with `{ success: false, code: "FORBIDDEN" }`.

---

## 3. Feature 2: Platform Overview (`/app/admin`)

### Objective
Verify that the Platform Command Center loads 8 real-time platform metrics from `GET /api/admin/stats`, displays notification alerts for pending items, and handles network refreshes.

### Test Steps
1. Navigate to `http://localhost:2000/app/admin`.
2. Inspect the **8 Primary Metrics**:
   - **Total Teachers:** Number of registered instructor accounts.
   - **Approved Teachers:** Number of instructors with approved vetting.
   - **Pending Teachers:** Instructors awaiting super admin review.
   - **Total Courses:** Catalog size across platform.
   - **Published Courses:** Courses visible on the storefront.
   - **Total Students:** Enrolled student count.
   - **Pending Payments:** Queue of unreviewed manual UPI transfers.
   - **Approved Payments:** Settled immutable payments.
3. Inspect the **Action Required Banner**:
   - If pending teachers or payments exist, an amber banner appears displaying direct quick-links to *Review Teachers* and *Review Payments*.
4. Click the **"Refresh Metrics"** button in the header.
5. **Expected Result:**
   - Spinning indicator displays briefly while refreshing without full page reload.
   - All numbers update to reflect current database counts.

### Database Verification
Run in `mongosh` or your MongoDB GUI:
```javascript
db.users.countDocuments({ role: "teacher" })
db.courses.countDocuments()
db.payments.countDocuments({ status: "pending" })
```
The counts on the screen should match these queries exactly.

---

## 4. Feature 3: Teacher Management (`/app/admin/teachers`)

### Objective
Verify instructor listing, text search, vetting status filters, temporary account provisioning, vetting approval, suspension/reactivation, and dossier inspection.

### Test 3.1: Provision a New Teacher Account
1. Navigate to `http://localhost:2000/app/admin/teachers`.
2. Click the **"Provision Instructor"** button (top right).
3. Fill out the modal:
   - **Full Name:** `Dr. Maya Raman`
   - **Email Address:** `maya.raman@testuniv.edu`
   - **Phone Number:** `9876543210`
   - **Temporary Password:** `SecurePass2026!` (must be at least 12 characters)
   - **Professional Headline:** `Senior Quantum Mechanics Lecturer`
   - **Bio / Background:** `15 years of university research and online teaching.`
   - **Platform Commission:** Select `20%` (or custom).
   - **Instant Super Admin Approval:** Leave unchecked to test the pending queue.
4. Click **"Provision Teacher Account"**.
5. **Expected Result:**
   - Modal closes.
   - Green success banner: `Instructor account "Dr. Maya Raman" created successfully.`
   - New row appears with `Pending Review` (amber badge) and `Active` (emerald badge).

### Test 3.2: Filter & Search Instructors
1. In the search bar, type `Maya`.
2. **Expected Result:** Only Dr. Maya Raman appears.
3. Clear the search. Click the **"Pending Approvals"** status tab.
4. **Expected Result:** Only unapproved teachers appear in the list.

### Test 3.3: Approve Instructor Application
1. On Dr. Maya Raman's row, click the emerald **"Approve"** button.
2. An accessible confirmation modal appears: *"Confirm Teacher Approval: Are you sure you want to approve Dr. Maya Raman?"*.
3. Click **"Approve Teacher"**.
4. **Expected Result:**
   - Badge changes immediately to `Approved` (emerald).
   - The "Approve" button disappears.
   - Overview metrics for approved teachers increments by 1.

### Test 3.4: Suspend & Reactivate Instructor
1. On the teacher row, click **"Suspend"**.
2. Confirmation modal asks to confirm suspension.
3. Click **"Suspend Instructor"**.
4. **Expected Result:**
   - Account status badge changes to `Suspended` (rose).
   - Button text switches to **"Reactivate"**.
5. Click **"Reactivate"** and confirm.
6. **Expected Result:** Status badge returns to `Active`.

### Test 3.5: Inspect Instructor Dossier
1. Click **"Dossier"** on any teacher row.
2. A slide-over drawer opens displaying:
   - Full instructor profile, email, phone, joined date.
   - Commission rate (20%) and teacher payout split (80%).
   - List of all courses authored by this teacher with prices and publication status.

---

## 5. Feature 4: Course Catalog Governance (`/app/admin/courses`)

### Objective
Verify platform-wide course listing, search, publication toggles, deletion safeguards, and ownership badges clearly separating Platform-owned from Teacher-owned courses.

### Test 4.1: Verify Ownership Distinctions
1. Navigate to `http://localhost:2000/app/admin/courses`.
2. Inspect the **Ownership** column:
   - Courses created by Super Admin show an amber badge: `Platform Owned`.
   - Courses created by/assigned to a teacher show an indigo badge: `Teacher: [Name]`.
3. Filter courses:
   - Click **"Platform"** in the ownership filter -> Only platform courses appear.
   - Click **"Teacher"** -> Only teacher-owned courses appear.

### Test 4.2: Create a Course with Owner Assignment
1. Click **"Create New Course"** button.
2. In the modal:
   - **Course Title:** `Advanced Classical Mechanics`
   - **Storefront Price:** `1999`
   - **Instructor Display Label:** `Dr. Maya Raman`
   - **Course Owner (Royalty Recipient):** Select `Teacher: Dr. Maya Raman`.
3. Click **"Create Course Record"**.
4. **Expected Result:**
   - Course created with `Draft` status and `Teacher: Dr. Maya Raman` ownership badge.

### Test 4.3: Toggle Publication
1. Click **"Publish"** on the newly created course.
2. Confirm the action in the dialog.
3. **Expected Result:** Badge turns to `Published` (emerald). The course is now visible in the storefront.
4. Click **"Unpublish"** and confirm.
5. **Expected Result:** Badge returns to `Draft`.

### Test 4.4: Deletion Safeguards (Negative Test)
1. Locate any course that has existing student enrollments or payment records.
2. Click **"Delete"** and confirm.
3. **Expected Result:**
   - Deletion is rejected.
   - Error banner displays: `Course cannot be deleted because financial payment records exist for it. Unpublish it instead.`

---

## 6. Feature 5: Student Directory & Dossier (`/app/admin/students`)

### Objective
Verify student search, pagination, enrollment history inspection, and administrative enrollment status overrides.

### Test Steps
1. Navigate to `http://localhost:2000/app/admin/students`.
2. Search by student name or email (e.g., `student`).
3. Click **"Dossier"** on a student row.
4. In the Student Dossier modal:
   - View student profile information (sensitive tokens and password hashes are never exposed).
   - View enrolled courses and their current status (`active`, `pending`, `suspended`, `expired`).
5. Change enrollment status:
   - Select a different status from the dropdown (e.g., switch `active` to `suspended`).
6. **Expected Result:**
   - The status updates immediately in the UI.
   - Success toast appears: `Enrollment status updated to "suspended".`

---

## 7. Feature 6: Payments & Settlements Engine (`/app/admin/payments`)

### Objective
Verify manual payment queue filtering, screenshot receipt inspection, server-calculated financial snapshot generation, idempotent approvals, and rejection with recorded reason.

### Test 6.1: Queue Filtering & Receipt Proof Check
1. Navigate to `http://localhost:2000/app/admin/payments`.
2. Tabs available:
   - **Pending Verification** (shows live pending count).
   - **Approved Settlements**.
   - **Rejected**.
   - **All Transactions**.
3. Select any pending payment row and click **"Review & Verify"**.
4. The Verification Modal opens:
   - **Payment Proof:** Displays the uploaded receipt image or fallback indicator.
   - **Student & Course:** Displays student details and course price.
   - **Ownership Split:** Shows teacher name and projected commission split (e.g., 20% platform / 80% teacher).

### Test 6.2: Payment Approval & Server Financial Calculation
1. In the modal, click **"Approve & Activate Enrollment"**.
2. Browser prompt confirms the action.
3. **Expected Result:**
   - Payment status changes to `Approved`.
   - **Financial Settlement Snapshot** section appears displaying:
     - **Platform Commission (20%):** Server calculated (e.g., ₹399.80 for a ₹1999 course).
     - **Teacher Share (80%):** Server calculated (e.g., ₹1599.20).
     - **Settlement Method:** `manual_platform`.
     - **Calculation Timestamp:** ISO date of approval.
   - Student enrollment in the course is activated immediately.
4. Close modal and reopen:
   - The approved snapshot remains permanently intact (immutable).

### Test 6.3: Payment Rejection with Mandatory Reason
1. Find another pending payment or create a test one.
2. Click **"Review & Verify"**.
3. Click **"Reject Payment"**.
4. A rejection reason textarea appears:
   - Try clicking "Confirm Rejection" without entering text -> Error prompts: *Please provide a rejection reason for the student.*
   - Enter reason: `Transaction reference mismatch with platform bank statement.`
5. Click **"Confirm Rejection"**.
6. **Expected Result:**
   - Status updates to `Rejected` (rose badge).
   - The rejection reason is recorded on the record and emailed to the student.

---

## 8. Feature 7: Platform Settings Placeholder (`/app/admin/settings`)

### Objective
Verify that platform settings are clearly labeled as a placeholder in Phase 3.2 without broken controls.

### Test Steps
1. Navigate to `http://localhost:2000/app/admin/settings`.
2. **Expected Result:**
   - Page renders explaining Phase 3.2 boundaries: global 20% commission policy, Bunny Stream CDN configuration, and email settings remain backend/environment driven.

---

## 9. Security & Anti-Regression Verification

### 9.1 CSRF Token Enforcement
- Every state-changing action in the admin dashboard (approving teacher, toggling active status, creating courses, approving/rejecting payments, changing enrollment status) automatically includes the CSRF token via `x-csrf-token` header.
- If the token is stripped or invalid, the backend immediately rejects with HTTP `403 CSRF_TOKEN_INVALID`.

### 9.2 Session Expiry Handling
- If the Super Admin session expires while on an admin page:
  - Any subsequent API fetch receives `401 UNAUTHORIZED`.
  - The client redirects to `/app/login` with an informational notice.

---

## 10. Troubleshooting Guide

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Metric counts display `--` or error | Backend API not reachable or session expired | Verify server is running on port 2000; log in again at `/app/login`. |
| Approval button returns 403 | Missing or mismatched CSRF token | Refresh the browser to fetch a new token via `/api/csrf-token`. |
| "Course cannot be deleted" error | Course has associated payments/enrollments | This is intentional to preserve financial audit integrity. Unpublish the course instead. |
| React styling appears unstyled | Vite dist bundle out of date | Run `npm run client:build` to compile production assets. |
