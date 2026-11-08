# EduVibe — Phase 2 Comprehensive Manual Testing Guide

This manual testing guide is written for non-technical quality assurance (QA) testers, product managers, and reviewers. It provides exact, step-by-step procedures to verify the platform features implemented up to Phase 2.

---

## 1. Important Architecture Note: UI vs. API Distinction

EduVibe is currently in a transitional architecture between **Phase 1/Legacy (Server-Side Rendered EJS Views)** and **Phase 2 (Headless RESTful JSON API)** in preparation for the Phase 3 React/Vite Single Page Application frontend.

| Feature Category | Availability | How to Test |
| :--- | :--- | :--- |
| **Public Storefront & Catalog** | **Web UI & API** | Browser UI (`/`, `/courses`) AND REST API (`/api/public/*`) |
| **Student Web Portal & Video Player** | **Web UI & API** | Browser UI (`/dashboard`, `/lessons/:id`) AND REST API (`/api/student/*`) |
| **Super Admin Course/Lesson Management** | **Web UI & API** | Browser UI (`/admin/courses`) AND REST API (`/api/admin/courses`) |
| **Super Admin Student & Enrollment Ops** | **Web UI & API** | Browser UI (`/admin/students`, `/admin/enrollments`) AND REST API (`/api/admin/students`) |
| **Super Admin Payment Approvals** | **Web UI & API** | Browser UI (`/admin/payments`) AND REST API (`/api/admin/payments/*`) |
| **Teacher Account Management** | **API-Only (Headless)** | REST API (`/api/admin/teachers/*`) |
| **Teacher Portal & Isolated Workspace** | **API-Only (Headless)** | REST API (`/api/teacher/*`) |

> [!NOTE]
> There is **no EJS web interface** for Teacher Management or Teacher Portals. In Phase 2, all multi-tenant teacher features were intentionally implemented as secure, headless RESTful JSON APIs. The user interface for teachers will be built in Phase 3 using React and Vite.

---

## 2. Test Accounts & Prerequisites

Ensure the local server is running:
```bash
npm run dev
# Server runs at http://localhost:2000
```

### Reference Accounts

| Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `radmin@blueprint.com` | `RadmiN2201` | Full platform administration & financial approval |
| **Teacher A** | `teacher.alpha@example.com` | `TeacherPass123!` | Course owner (Alpha) |
| **Teacher B** | `teacher.beta@example.com` | `TeacherPass123!` | Course owner (Beta) for cross-tenant isolation tests |
| **Student A** | `alice.student@example.com` | `StudentPass123!` | Standard learner purchasing and watching content |

---

## 2.1. Test Database Isolation & Safety Architecture

To protect development and production environments from accidental mutation or dangling records, EduVibe enforces strict database isolation between runtime and testing environments:

### Environment Configuration

* **`MONGODB_URI`** in `.env`: Points to the primary platform database (`paid-course-platform`). Used exclusively by `npm run dev` and `npm start`.
* **`TEST_MONGODB_URI`** in `.env`: Points to the dedicated isolated test database (`eduviber-test-isolated`). Used exclusively by `npm test`.

### Automated Safety Interlocks ([config/testDbGuard.js](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/config/testDbGuard.js))

1. **Mandatory Configuration**: If `TEST_MONGODB_URI` is missing or empty, all tests immediately abort with a descriptive fatal error. Tests **never** fall back to `MONGODB_URI`.
2. **Production Interlock**: If `TEST_MONGODB_URI` targets the primary database (`paid-course-platform`) or is identical to `MONGODB_URI`, tests abort immediately.
3. **Naming Convention Guard**: The test database name must explicitly contain `"test"` (e.g., `eduviber-test-isolated`).
4. **Runtime Connection Assertions**: Every test suite and migration runner verifies the active connection against these rules before executing any write operations.

### How to Manually Verify Database Isolation

#### 1. Verify Normal Development Connects to the Primary Database
1. Run `npm run dev` in your terminal.
2. In your browser or cURL, query the health endpoint: `http://localhost:2000/health`.
3. Check the server console log:
   ```
   MongoDB Atlas connected successfully
   ```
   The application is bound to `paid-course-platform`. Your real courses (`testing` and `Full Lifecycle Masterclass`) and admin account are loaded.

#### 2. Verify `npm test` Does Not Mutate Production Records
1. Before running tests, snapshot the state of production courses:
   ```bash
   node -e '
   import mongoose from "mongoose";
   import "dotenv/config";
   import Course from "./models/Course.js";
   await mongoose.connect(process.env.MONGODB_URI);
   const courses = await Course.find({}, { title: 1, ownerId: 1, updatedAt: 1 }).lean();
   console.log("BEFORE TESTS:", courses);
   await mongoose.disconnect();
   '
   ```
2. Run the test suite:
   ```bash
   npm test
   ```
3. Observe the test output: All suites log `✓ Connected to isolated test database: [eduviber-test-isolated]`.
4. Re-check the production database:
   ```bash
   node -e '
   import mongoose from "mongoose";
   import "dotenv/config";
   import Course from "./models/Course.js";
   await mongoose.connect(process.env.MONGODB_URI);
   const courses = await Course.find({}, { title: 1, ownerId: 1, updatedAt: 1 }).lean();
   console.log("AFTER TESTS:", courses);
   await mongoose.disconnect();
   '
   ```
5. **Expected Result**: The `updatedAt` timestamps, IDs, titles, and `ownerId` values in `paid-course-platform` are 100% identical before and after `npm test`. Zero production mutations occurred.

---

## 3. Web UI Manual Test Procedures

### Test Case UI-01: Public Storefront & Course Catalog Browsing
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/`
- **Account**: None (Unauthenticated / Anonymous Visitor)

#### Steps:
1. Open an incognito browser window and navigate to `http://localhost:2000/`.
2. Observe the landing page headline, hero section, and featured courses.
3. Click the **"Browse Courses"** navigation link in the top header.
4. Verify you are redirected to `http://localhost:2000/courses`.
5. Click on an available published course card (e.g., "Full Lifecycle Masterclass" or "testing").
6. Verify you are redirected to `http://localhost:2000/courses/<course-slug>`.
7. Scroll down to inspect the syllabus.

#### Expected Result:
- Only **published** courses appear in the catalog.
- The course detail page renders the title, description, instructor name, and price.
- The syllabus displays published module names and lesson titles.
- **Security Check**: Internal Bunny.net video IDs (GUIDs) and direct video player URLs are completely hidden from the page HTML source (Right-click -> "View Page Source" -> search for `bunny` or `libraryId` -> 0 matches).

#### Negative Test Procedure:
1. In the browser address bar, attempt to navigate to a draft/unpublished course or a fake slug: `http://localhost:2000/courses/non-existent-secret-slug`.

#### Pass/Fail Criteria:
- **PASS**: The browser displays a clean, branded **HTTP 404 "Page Not Found"** page without leaking stack traces or internal database errors.
- **FAIL**: Internal server error (HTTP 500), raw JSON, or access to draft content.

---

### Test Case UI-02: Student Login, Forced Password Reset & Dashboard
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/login`
- **Account**: `alice.student@example.com` (or admin-created student with `mustChangePassword: true`)

#### Steps:
1. Navigate to `http://localhost:2000/login`.
2. In the Email field, enter the student email.
3. In the Password field, enter the initial temporary password.
4. Click the **"Sign In"** button.

#### Expected Result:
- If `mustChangePassword` is set to `true`: You are immediately redirected to `http://localhost:2000/change-password` with a banner: *"You must update your password before continuing."*
- Enter a new secure password (minimum 12 characters, e.g., `NewSecurePassword2026!`).
- Confirm the new password and click **"Update Password"**.
- You are redirected to `http://localhost:2000/dashboard`.
- The dashboard welcomes the student by name and displays enrolled courses.

#### Negative Test Procedure:
1. Go to `http://localhost:2000/login`.
2. Enter an incorrect password (e.g., `WrongPassword123!`).
3. Click **"Sign In"**.

#### Pass/Fail Criteria:
- **PASS**: An error message *"Invalid email or password"* is displayed. The user is not logged in.
- **FAIL**: Login succeeds with bad credentials or crashes with HTTP 500.

---

### Test Case UI-03: Student Course Enrollment & Payment Proof Submission
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/courses`
- **Account**: `alice.student@example.com` (Logged in as Student)

#### Steps:
1. Browse to `http://localhost:2000/courses` and select a published course you are not yet enrolled in.
2. Click the **"Enroll Now"** or **"Buy Course"** button.
3. You are navigated to `http://localhost:2000/courses/<slug>/enroll`.
4. Review the payment instructions (Bank Transfer / UPI ID / QR details).
5. In the **Transaction Reference (UTR / UPI Ref)** field, enter: `UPI-MANUAL-TEST-998877`.
6. In the **Proof of Payment URL** field, enter: `https://drive.google.com/file/d/test-receipt/view`.
7. Click the **"Submit Payment Proof"** button.

#### Expected Result:
- You are redirected to the enrollment success/pending page `http://localhost:2000/courses/<slug>/enroll-success`.
- A message informs you: *"Payment Submitted — Pending Verification"*.
- The course is not yet accessible for playback.
- If you attempt to access a lesson URL directly before approval, you receive an HTTP 403 or redirect to pending status.

#### Negative Test Procedure:
1. Go back to `http://localhost:2000/courses/<slug>/enroll`.
2. Try submitting an empty Transaction Reference or a forged price form.

#### Pass/Fail Criteria:
- **PASS**: The system rejects empty transaction references with a validation error.
- **FAIL**: Student gains immediate video watch access without admin approval.

---

### Test Case UI-04: Super Admin Payment Review & Financial Approval
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/login`
- **Account**: `radmin@blueprint.com` / `RadmiN2201` (Super Admin)

#### Steps:
1. Navigate to `http://localhost:2000/login` and log in with Super Admin credentials.
2. You are redirected to `http://localhost:2000/admin`.
3. In the sidebar navigation, click **"Payments"** (or go to `http://localhost:2000/admin/payments`).
4. Locate the newly submitted payment (`UPI-MANUAL-TEST-998877`) with status **"Pending"**.
5. Click on the proof link to inspect the payment proof.
6. Click the green **"Approve"** button.
7. Confirm the approval prompt.

#### Expected Result:
- The payment status badge immediately changes from yellow **"Pending"** to green **"Approved"**.
- A notification confirms approval.
- An email notification is dispatched to the student (logged in server console in development mode).
- The student's enrollment record is automatically activated in the database.

#### Negative Test Procedure (Rejection Flow):
1. For a fake or invalid payment submission, click the red **"Reject"** button.
2. Enter a rejection reason in the modal/field: *"Transaction reference not found in bank statement."*
3. Click **"Confirm Rejection"**.
4. The payment status changes to red **"Rejected"** with the reason preserved.

#### Pass/Fail Criteria:
- **PASS**: Approving activates enrollment; rejecting blocks enrollment and records the reason.
- **FAIL**: Payment approval fails to activate student enrollment or crashes with an unhandled exception.

---

### Test Case UI-05: Student Video Playback & Dynamic Watermarking
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/dashboard`
- **Account**: `alice.student@example.com` (Approved Student)

#### Steps:
1. Log in as the approved student and navigate to `http://localhost:2000/dashboard`.
2. Under "Enrolled Courses", click on the approved course.
3. Click on **Lesson 1** to open the video player: `http://localhost:2000/student/courses/<courseId>/lessons/<lessonId>`.
4. Observe the video player interface.

#### Expected Result:
- The video player loads using a signed, time-limited Bunny.net iframe embed token.
- A dynamic, semi-transparent watermark containing the student's email address (`alice.student@example.com`) and current timestamp overlays the video player to discourage screen recording.
- As the video plays, progress is periodically tracked and synchronized back to the server.
- The sidebar checklist shows the lesson checked as completed once finished.

#### Negative Test Procedure:
1. Copy the current lesson URL.
2. Open a separate incognito window (unauthenticated) and paste the lesson URL.
3. Attempt to watch the video.

#### Pass/Fail Criteria:
- **PASS**: The unauthenticated request is redirected to `/login`. The video does not play.
- **FAIL**: An unauthenticated user can watch the video or the watermark is missing.

---

### Test Case UI-06: Existing EJS Web UI Regression Check
- **Feature Status**: Working Web UI
- **Starting URL**: `http://localhost:2000/admin`
- **Account**: `radmin@blueprint.com` (Super Admin)

#### Steps:
1. Navigate to `http://localhost:2000/admin/courses` -> Click **"New Course"** -> Enter Title, Description, Price -> Click **"Create Course"**.
2. Navigate to Course Lessons -> Click **"New Lesson"** -> Enter Module, Title, Order, Duration, Bunny Video ID -> Click **"Save Lesson"**.
3. Navigate to `http://localhost:2000/admin/students` -> Verify student list renders cleanly.
4. Navigate to `http://localhost:2000/admin/enrollments` -> Verify enrollments list renders cleanly.
5. In any form, right-click and inspect the hidden CSRF input field: `<input type="hidden" name="_csrf" value="...">`.

#### Pass/Fail Criteria:
- **PASS**: All EJS views render without template errors, CSS styling is preserved, and state changes work with valid CSRF tokens.
- **FAIL**: Any EJS template compilation error (`ReferenceError: ... is not defined`).

---

## 4. API-Only Manual Test Procedures (RESTful JSON)

For API testing, use **cURL**, **Postman**, or your browser's Developer Tools Console (`Fetch API`).

> [!IMPORTANT]
> **CSRF Authentication Procedure for APIs**:
> 1. All state-changing requests (`POST`, `PATCH`, `DELETE`, `PUT`) require a valid session cookie AND an `x-csrf-token` header.
> 2. Fetch a fresh CSRF token anytime from: `GET /api/csrf-token`.

---

### Test Case API-01: CSRF Token & Authentication Workflow
- **Feature Status**: API Only
- **Endpoint**: `GET /api/csrf-token` and `POST /api/auth/login`

#### Step 1: Obtain CSRF Token
Execute in terminal:
```bash
curl -c cookies.txt -s -X GET http://localhost:2000/api/csrf-token
```
**Expected Response (HTTP 200)**:
```json
{
  "success": true,
  "csrfToken": "a1b2c3d4..."
}
```

#### Step 2: Login via JSON API
```bash
curl -b cookies.txt -c cookies.txt -s -X POST http://localhost:2000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN_FROM_STEP_1>" \
  -d '{"email":"radmin@blueprint.com","password":"RadmiN2201"}'
```
**Expected Response (HTTP 200)**:
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "6ad667e1e8ec45024d00fcdd",
      "name": "RadmiN",
      "email": "radmin@blueprint.com",
      "role": "super_admin"
    }
  }
}
```

#### Negative Test Procedure:
Send the login request without the `x-csrf-token` header.
**Expected Response**: `HTTP 403 Forbidden` with `{ "success": false, "message": "Invalid or missing CSRF token." }`.

---

### Test Case API-02: Super Admin Provisions & Approves a Teacher
- **Feature Status**: API Only
- **Endpoint**: `POST /api/admin/teachers` and `POST /api/admin/teachers/:id/approve`
- **Prerequisite**: Logged in as Super Admin (`radmin@blueprint.com`)

#### Step 1: Provision New Teacher
```bash
curl -b cookies.txt -c cookies.txt -s -X POST http://localhost:2000/api/admin/teachers \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{
    "name": "Professor Charles Xavier",
    "email": "charles@xavierschool.edu",
    "phone": "9876543210",
    "headline": "Lead Mind & Educator",
    "bio": "Teaching advanced cognitive development.",
    "commissionRate": 0.20
  }'
```
**Expected Response (HTTP 201 Created)**:
```json
{
  "success": true,
  "message": "Teacher account provisioned successfully.",
  "data": {
    "teacher": {
      "id": "<NEW_TEACHER_ID>",
      "name": "Professor Charles Xavier",
      "email": "charles@xavierschool.edu",
      "role": "teacher",
      "teacherProfile": {
        "isApproved": false,
        "commissionRate": 0.20
      }
    }
  }
}
```

#### Step 2: Approve the Teacher
```bash
curl -b cookies.txt -c cookies.txt -s -X POST http://localhost:2000/api/admin/teachers/<NEW_TEACHER_ID>/approve \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>"
```
**Expected Response (HTTP 200 OK)**:
```json
{
  "success": true,
  "message": "Teacher approved successfully.",
  "data": {
    "teacher": {
      "id": "<NEW_TEACHER_ID>",
      "teacherProfile": {
        "isApproved": true
      }
    }
  }
}
```

---

### Test Case API-03: Teacher A Creates a Course & Lessons
- **Feature Status**: API Only
- **Prerequisite**: Logged in as approved Teacher (`teacher.alpha@example.com`)

#### Step 1: Create Course
```bash
curl -b teacher_cookies.txt -c teacher_cookies.txt -s -X POST http://localhost:2000/api/teacher/courses \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <TEACHER_CSRF_TOKEN>" \
  -d '{
    "title": "Quantum Computing 101",
    "description": "Introduction to qubits and quantum algorithms.",
    "price": 1999,
    "thumbnail": "https://example.com/quantum.jpg"
  }'
```
**Expected Response (HTTP 201 Created)**:
- Returns course object with `ownerId` set strictly to Teacher A's user ID.
- Even if a client attempts to inject `"ownerId": "<SOMEONE_ELSE>"`, the server ignores it and assigns Teacher A.

#### Step 2: Add Lesson to Own Course
```bash
curl -b teacher_cookies.txt -c teacher_cookies.txt -s -X POST http://localhost:2000/api/teacher/courses/<COURSE_ID>/lessons \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <TEACHER_CSRF_TOKEN>" \
  -d '{
    "title": "Superposition Fundamentals",
    "description": "Understanding wavefunctions.",
    "moduleName": "Module 1",
    "order": 1,
    "durationSeconds": 450,
    "bunnyVideoId": "12345678-1234-1234-1234-123456789abc",
    "isPublished": true
  }'
```
**Expected Response (HTTP 201 Created)** with lesson details.

---

### Test Case API-04: Cross-Tenant Isolation & IDOR Protection (Negative Test)
- **Feature Status**: API Security Verification
- **Scenario**: Teacher B attempts to view, edit, or delete Teacher A's course or lessons.
- **Account**: Logged in as Teacher B (`teacher.beta@example.com`)

#### Step 1: Teacher B tries to GET Teacher A's course
```bash
curl -b teacher_b_cookies.txt -s -X GET http://localhost:2000/api/teacher/courses/<TEACHER_A_COURSE_ID>
```
**Expected Response (HTTP 403 Forbidden)**:
```json
{
  "success": false,
  "message": "Access denied: You do not own this course.",
  "code": "FORBIDDEN"
}
```

#### Step 2: Teacher B tries to UPDATE Teacher A's course
```bash
curl -b teacher_b_cookies.txt -s -X PATCH http://localhost:2000/api/teacher/courses/<TEACHER_A_COURSE_ID> \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <TEACHER_B_CSRF_TOKEN>" \
  -d '{"title": "Hacked Course Title"}'
```
**Expected Response (HTTP 403 Forbidden)**:
- Request is rejected.
- In the database, Teacher A's course title remains unchanged.

#### Pass/Fail Criteria:
- **PASS**: Teacher B receives HTTP 403 on all operations targeting Teacher A's content.
- **FAIL**: Any mutation or read succeeds across teacher boundaries.

---

### Test Case API-05: Financial Immutability via REST API
- **Feature Status**: Financial Integrity Verification
- **Prerequisite**: A payment has been submitted by a student.

#### Step 1: Super Admin Approves Payment via API
```bash
curl -b admin_cookies.txt -c admin_cookies.txt -s -X POST http://localhost:2000/api/admin/payments/<PAYMENT_ID>/approve \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <ADMIN_CSRF_TOKEN>"
```
**Expected Response (HTTP 200 OK)**:
```json
{
  "success": true,
  "message": "Payment approved successfully.",
  "data": {
    "payment": {
      "id": "<PAYMENT_ID>",
      "status": "approved",
      "financialSnapshot": {
        "coursePrice": 1500,
        "commissionRate": 0.20,
        "platformCommission": 300,
        "teacherShare": 1200,
        "currency": "INR",
        "collectionMethod": "manual_platform",
        "calculatedAt": "2026-11-02T..."
      }
    }
  }
}
```

#### Step 2: Negative Test — Direct Mutation Attempt
Attempt to mutate `financialSnapshot` via Mongoose or query updates:
- Database Mongoose pre-hooks actively throw `"Financial snapshot is immutable once recorded."`
- API layer exposes **zero** endpoints for updating financial snapshots.

#### Pass/Fail Criteria:
- **PASS**: Snapshot accurately computes the 80/20 split and remains completely immutable.
- **FAIL**: Teacher share or platform commission can be overwritten after approval.

---

## 5. Summary Checklist for QA Testers

| # | Test Scenario | Type | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Storefront browsing & hidden video IDs | Web UI | [ ] | Verify no GUID leakage in HTML |
| 2 | Student login & forced password reset | Web UI | [ ] | Minimum 12-char validation |
| 3 | Student payment submission & pending state | Web UI | [ ] | Video locked while pending |
| 4 | Super Admin payment approval workflow | Web UI | [ ] | Enrollment activated |
| 5 | Video playback with dynamic watermark | Web UI | [ ] | Email watermark visible |
| 6 | Super Admin courses, lessons, students | Web UI | [ ] | Existing EJS regression |
| 7 | CSRF enforcement on state-changing forms | Web UI | [ ] | HTTP 403 on missing token |
| 8 | Teacher account provisioning & approval | REST API | [ ] | Headless API only |
| 9 | Teacher course creation with scoped ownership | REST API | [ ] | ownerId bound to teacher |
| 10 | Cross-tenant isolation (IDOR rejection) | REST API | [ ] | HTTP 403 on cross-owner edit |
| 11 | Financial snapshot calculation & immutability | REST API | [ ] | 80/20 split locked |
