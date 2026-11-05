# EduVibe — Phase 3.3 Teacher Studio: Manual Testing Guide

This manual testing guide details end-to-end verification of the **Teacher Studio** React portal in EduVibe. It covers dashboard metrics, course creation/management, curriculum and lesson editing, server-side Bunny Stream video upload integration, tenant-isolated student monitoring, student progress inspection, teacher profile management, and negative tests verifying strict ownership and account status restrictions.

---

## 1. Prerequisites and Environment Setup

### 1.1 Local Server Startup
Ensure the backend server and client build are prepared:
```bash
# In project root:
npm run client:build
npm start
# (or concurrently in development: npm run dev & npm run client:dev)
```

The application is served at: `http://localhost:3000` (or your configured port).

### 1.2 Canonical URLs
- **Teacher Studio Overview**: `http://localhost:3000/app/teacher`
- **My Courses**: `http://localhost:3000/app/teacher/courses`
- **Course & Lesson Curriculum Editor**: `http://localhost:3000/app/teacher/courses/:id`
- **Enrolled Students & Progress**: `http://localhost:3000/app/teacher/students`
- **Instructor Profile**: `http://localhost:3000/app/teacher/profile`
- **Earnings & Royalties (Placeholder)**: `http://localhost:3000/app/teacher/earnings`
- **Unified Login**: `http://localhost:3000/app/login`

---

## 2. Test Account Requirements

Prepare four test accounts (or use the seed script/admin portal to create them):

| Role / Identifier | Email | Password | Account Status | Approval Status | Commission / Share |
|---|---|---|---|---|---|
| **Teacher Alpha (Teacher A)** | `teacher_alpha@test.com` | `Password123!` | Active (`isActive: true`) | Approved (`isApproved: true`) | 25% Platform / 75% Teacher |
| **Teacher Beta (Teacher B)** | `teacher_beta@test.com` | `Password123!` | Active (`isActive: true`) | Approved (`isApproved: true`) | 20% Platform / 80% Teacher |
| **Unapproved Teacher** | `unapproved_teacher@test.com` | `Password123!` | Active (`isActive: true`) | Unapproved (`isApproved: false`) | Default 20% / 80% |
| **Suspended Teacher** | `suspended_teacher@test.com` | `Password123!` | Suspended (`isActive: false`) | Approved (`isApproved: true`) | N/A |
| **Student One** | `student_one@test.com` | `Password123!` | Active (`isActive: true`) | N/A | N/A |
| **Student Two** | `student_two@test.com` | `Password123!` | Active (`isActive: true`) | N/A | N/A |

---

## 3. Test Scenarios

---

### Test Suite 1: Teacher Studio Dashboard & Live Metrics
**Objective:** Verify dashboard overview displays real backend aggregated statistics and correct revenue share split without fabricated data.

1. Navigate to `/app/login`.
2. Sign in with **Teacher Alpha** (`teacher_alpha@test.com` / `Password123!`).
3. Verify automatic redirection to `/app/teacher`.
4. **Expected Results:**
   - Header shows "Teacher Studio" with live subtitle and user name.
   - 4 metric cards:
     - **Total Courses:** Displays total count owned by Teacher Alpha.
     - **Published Courses:** Count of published courses.
     - **Draft Courses:** Count of draft courses.
     - **Active Students:** Total unique students enrolled in Teacher Alpha's courses.
   - **Financial Terms Card:** Shows Teacher Revenue Share (e.g. 75%) and Platform Commission (e.g. 25%).
   - Empty state is cleanly shown if no courses have been published yet with a "Create Course" quick-action button.

---

### Test Suite 2: Course Creation, Editing & Draft/Publishing
**Objective:** Verify course lifecycle management, validation, and strict draft/publish status handling.

1. In the sidebar, click **My Courses** (`/app/teacher/courses`).
2. Click **+ Create New Course**.
3. In the modal:
   - **Course Title:** `Distributed Systems with Go & gRPC`
   - **Description:** `Master high-concurrency microservices architecture from scratch.`
   - **Price (INR):** `3499`
   - **Thumbnail URL:** `https://images.unsplash.com/photo-1517694712202-14dd9538aa97`
4. Click **Create Draft Course**.
5. **Expected Results:**
   - Modal closes, success banner notifies creation.
   - The new course appears in the course list with a gray **Draft** badge.
   - "Unpublished" status is clearly displayed.
   - Teacher Alpha is displayed as instructor; ownerId is locked to Teacher Alpha.
6. Click **Publish** button on the course card:
   - Badge changes to a vibrant green **Published** badge.
   - Action toggle becomes **Unpublish**.
7. Return to Overview (`/app/teacher`):
   - **Published Courses** count increments by 1.
   - **Draft Courses** count decrements accordingly.

---

### Test Suite 3: Course & Lesson Curriculum Editor
**Objective:** Verify course metadata updates, module organization, lesson creation, duration, and sequencing.

1. In **My Courses**, click **Curriculum & Editor** (or the title) for `Distributed Systems with Go & gRPC`.
2. Verify URL is `/app/teacher/courses/<courseId>`.
3. Under **Course Details**:
   - Update **Price (INR)** to `3999`.
   - Click **Save Changes**.
   - Verify success toast and price reflects `₹3,999`.
4. In the **Curriculum & Lessons** section, click **+ Add Lesson**.
5. Fill the lesson modal:
   - **Lesson Title:** `01 - Introduction to Remote Procedure Calls`
   - **Module Name:** `Module 1: Architecture Overview`
   - **Sequence Order:** `1`
   - **Duration (Minutes):** `18`
   - **Free Preview:** Checked
   - **Publish Immediately:** Checked
   - **Bunny Stream Video GUID:** (Enter a valid 36-char GUID or upload a video as detailed in Test Suite 4).
6. Click **Save Lesson**.
7. **Expected Results:**
   - Lesson is added and grouped under `Module 1: Architecture Overview`.
   - Displays sequence badge `#1`, 18 min duration, and blue `Free Preview` pill.
8. Add a second lesson:
   - **Lesson Title:** `02 - Protobuf Schemas & Code Generation`
   - **Module Name:** `Module 1: Architecture Overview`
   - **Sequence Order:** `2`
   - **Duration (Minutes):** `32`
   - **Free Preview:** Unchecked
9. Click **Delete** on lesson 2:
   - Confirmation prompt appears.
   - Upon confirming, lesson 2 is removed cleanly from database and UI.

---

### Test Suite 4: Bunny Stream Video Upload Integration
**Objective:** Test secure server-side Bunny Stream video creation, binary upload, and GUID association without browser credentials.

1. In the Curriculum Editor, open the lesson creation modal (or edit an existing lesson).
2. Locate the **Video Source (Bunny Stream)** section.
3. Select the **Upload Video File** tab.
4. Select a short video file (`.mp4`, `.mov`, or `.webm`).
5. Click **Upload to Bunny Stream**.
6. **Expected Results:**
   - A real-time upload progress bar is displayed (0% -> 100%).
   - Server handles Bunny video creation and binary upload using server-side credentials (`BUNNY_STREAM_API_KEY`).
   - Browser network tab verifies:
     - Request is sent to `POST /api/teacher/courses/<courseId>/upload-video`.
     - Zero Bunny Stream API keys or private tokens are leaked in request headers or response bodies.
   - Upon completion, the returned Bunny Video GUID is automatically populated in the lesson's `bunnyVideoId` field with a green verification badge.
   - Save the lesson to persist the video attachment.

---

### Test Suite 5: Enrolled Students & Tenant Isolation
**Objective:** Demonstrate strict tenant isolation — Teacher A must never see Teacher B's students or courses.

1. Ensure **Student One** is enrolled in Teacher Alpha's course (`Distributed Systems with Go & gRPC`).
2. Ensure **Student Two** is enrolled in Teacher Beta's course (`Security Operations`).
3. While logged in as **Teacher Alpha**, navigate to **Enrolled Students** (`/app/teacher/students`).
4. **Expected Results:**
   - **Student One** (`student_one@test.com`) appears in the directory with course title `Distributed Systems with Go & gRPC`.
   - **Student Two** DOES NOT appear anywhere in Teacher Alpha's list.
5. In the same browser (or private window), log out and log in as **Teacher Beta** (`teacher_beta@test.com`).
6. Navigate to `/app/teacher/students`.
7. **Expected Results:**
   - **Student Two** (`student_two@test.com`) is displayed.
   - **Student One** DOES NOT appear in Teacher Beta's list.
   - Cross-tenant data isolation is fully preserved.

---

### Test Suite 6: Student Progress Inspection
**Objective:** Verify detailed per-lesson progress inspection for students enrolled in the teacher's course.

1. As **Teacher Alpha**, navigate to **Enrolled Students** (`/app/teacher/students`).
2. Next to Student One, click **View Progress**.
3. **Expected Results:**
   - Progress modal opens for Student One.
   - Shows overall completion percentage progress bar (e.g., 50%).
   - Shows summary statistics: Total Lessons, Completed Lessons, Remaining Lessons.
   - Shows detailed lesson-by-lesson table:
     - Module & Lesson Title.
     - Status: `Completed` or `In Progress`.
     - Progress: watched seconds / percentage.
     - Last Watched timestamp.
4. Verify that financial fields and payment amounts cannot be modified from this view.

---

### Test Suite 7: Instructor Profile Management
**Objective:** Verify teachers can edit headline, bio, display name, and payout UPI, while commission rates and approval status remain immutable.

1. In the sidebar, click **Instructor Profile** (`/app/teacher/profile`).
2. Verify **Account Status** displays a green `Approved Instructor` badge.
3. Verify **Financial Terms** displays the platform revenue share (e.g. `75% Teacher / 25% Platform`) in a read-only badge.
4. Modify the following fields:
   - **Headline:** `Distinguished Cloud Architect & Systems Specialist`
   - **Biography:** `15+ years architecting fault-tolerant backend infrastructure.`
   - **UPI ID:** `alpha.teacher@oksbi`
5. Click **Save Profile Changes**.
6. **Expected Results:**
   - Success toast confirms profile update.
   - Top-right navbar avatar/display name reflects updated profile.
   - Refresh the page: updated headline and UPI ID persist.
   - Commission rate remains unchanged and protected.

---

### Test Suite 8: Course Deletion Safeguards (Negative Tests)
**Objective:** Confirm backend prevents destructive deletion of courses with active students or payments.

1. Under **My Courses**, attempt to click **Delete** on a course that has active enrollments or recorded payments.
2. Confirm the browser dialog.
3. **Expected Results:**
   - Request returns HTTP 400 with code `ACTIVE_ENROLLMENTS_EXIST` or `FINANCIAL_RECORDS_EXIST`.
   - An alert banner is displayed: *"Course cannot be deleted because financial payment records or active student enrollments exist for it. Unpublish it instead."*
   - Course remains intact in the database.

---

### Test Suite 9: Negative Tests & Account Restrictions

#### 9.1 Tenant Course Access & Tampering
1. Copy the Course ID of Teacher Alpha's course: `<courseA1Id>`.
2. Log in as **Teacher Beta**.
3. Direct browser or API client to `GET /api/teacher/courses/<courseA1Id>`.
   - **Result:** HTTP 403 Forbidden (`Access denied. You do not own this course.`).
4. Attempt `PATCH /api/teacher/courses/<courseA1Id>` with body `{"title": "Hacked Title"}`:
   - **Result:** HTTP 403 Forbidden.
5. Attempt `DELETE /api/teacher/courses/<courseA1Id>`:
   - **Result:** HTTP 403 Forbidden.

#### 9.2 Unapproved Teacher Restrictions
1. Log in as **Unapproved Teacher** (`unapproved_teacher@test.com` / `Password123!`).
2. Navigate to `/app/teacher`:
   - An informational amber banner warns: *"Your instructor account is currently pending administrative review. You can prepare your profile, but cannot publish courses or enroll students until approved."*
3. Attempt to create a course or upload a video via `POST /api/teacher/courses`:
   - **Result:** HTTP 403 Forbidden with error code `TEACHER_NOT_APPROVED`.
4. Navigate to `/app/teacher/profile`:
   - Teacher can view their profile and update their bio/headline.

#### 9.3 Suspended Teacher Restrictions
1. Log in with **Suspended Teacher** credentials:
   - **Result:** Login is rejected with HTTP 401 (`Invalid email or password, or account unavailable.`).
2. For an existing active session that gets suspended in the database:
   - Any request to `/api/teacher/*` returns HTTP 403 with code `ACCOUNT_INACTIVE`.

---

## 4. Database Verification Commands

To verify database records directly using `mongosh`:

```javascript
// Connect to the database:
// mongosh "<YOUR_MONGODB_URI>"

// 1. Verify Course Ownership
db.courses.find({}, { title: 1, ownerId: 1, isPublished: 1, price: 1 });

// 2. Verify Lesson Sequencing
db.lessons.find({ courseId: ObjectId("<courseId>") }, { title: 1, order: 1, bunnyVideoId: 1 }).sort({ order: 1 });

// 3. Verify Teacher Commission & Profile
db.users.find({ role: "teacher" }, { name: 1, email: 1, "teacherProfile.commissionRate": 1, "teacherProfile.isApproved": 1, isActive: 1 });

// 4. Verify Student Progress Isolation
db.progresses.find({ userId: ObjectId("<studentId>") }, { lessonId: 1, completed: 1, lastPositionSeconds: 1 });
```
