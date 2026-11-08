# EduVibe — Phase 2 RESTful JSON API Documentation

This document provides a comprehensive inventory of all RESTful JSON API endpoints implemented in EduVibe during Phase 2.

All API routes are mounted under the `/api` prefix and communicate strictly using `application/json`.

---

## 1. Authentication & Security Architecture

### Session Cookie Authentication
- **Mechanism**: Same-origin session cookie (`course.sid`) backed by MongoDB Session Store (`connect-mongo`).
- **No JWTs**: All user identity, role, and authorization attributes are resolved dynamically on the server from `req.session.user`.
- **Role Verification**: Verified on every request. Roles are normalized (`admin` is treated as `super_admin`).
- **Teacher Account Guard**: Teachers must have `isActive: true` and `teacherProfile.isApproved: true`. Unapproved teachers receive HTTP 403 `TEACHER_NOT_APPROVED`.
- **Account Inactivity Guard**: Inactive accounts (`isActive: false`) are immediately rejected with HTTP 403 `ACCOUNT_INACTIVE` and their sessions destroyed.

### CSRF Protection
- **Method**: Double-submit CSRF cookie/header pattern.
- **Obtaining Token**: `GET /api/csrf-token` sets the session and returns `{ success: true, data: { csrfToken: "<token>" } }`.
- **Submission**: Send the token in header `x-csrf-token: <token>` or body field `_csrf: <token>` on all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).

### Standard Response Formats

#### Successful Response (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

#### Error Response (HTTP 400 / 401 / 403 / 404 / 500)
```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

---

## 2. Authentication API (`/api/auth`)

### 2.1 Get CSRF Token
- **Method**: `GET`
- **Endpoint**: `/api/csrf-token`
- **Access**: Public / Anonymous
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "csrfToken": "a8f3b..."
  }
}
```

### 2.2 Get Current Session Profile
- **Method**: `GET`
- **Endpoint**: `/api/auth/me`
- **Access**: Authenticated (`super_admin`, `teacher`, `student`)
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "609c...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "teacher",
      "isActive": true,
      "teacherProfile": {
        "isApproved": true,
        "commissionRate": 20
      }
    }
  }
}
```

### 2.3 User Login
- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Access**: Public / Anonymous
- **Headers**: `Content-Type: application/json`, `x-csrf-token: <csrfToken>`
- **Request Body**:
```json
{
  "email": "teacher@eduvibe.com",
  "password": "SecurePassword123"
}
```
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "609c...",
      "name": "Teacher Name",
      "email": "teacher@eduvibe.com",
      "role": "teacher"
    },
    "csrfToken": "newCsrfToken..."
  },
  "message": "Login successful"
}
```

### 2.4 User Logout
- **Method**: `POST`
- **Endpoint**: `/api/auth/logout`
- **Access**: Authenticated
- **Headers**: `x-csrf-token: <csrfToken>`
- **Response** (HTTP 200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2.5 Change Password
- **Method**: `POST`
- **Endpoint**: `/api/auth/change-password`
- **Access**: Authenticated
- **Headers**: `Content-Type: application/json`, `x-csrf-token: <csrfToken>`
- **Request Body**:
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewStrongPassword456",
  "confirmPassword": "NewStrongPassword456"
}
```

---

## 3. Public Discovery API (`/api/public`)

### 3.1 List Published Courses
- **Method**: `GET`
- **Endpoint**: `/api/public/courses`
- **Access**: Public
- **Query Parameters**:
  - `page` (number, default: 1)
  - `limit` (number, default: 12)
  - `search` (string, optional keyword)
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "609...",
        "title": "Mastering Node.js",
        "slug": "mastering-nodejs",
        "price": 1999,
        "currency": "INR",
        "teacher": {
          "id": "608...",
          "name": "Jane Teacher",
          "headline": "Lead Backend Architect"
        },
        "lessonCount": 15,
        "totalMinutes": 180
      }
    ],
    "pagination": { "page": 1, "limit": 12, "total": 1, "pages": 1 }
  }
}
```

### 3.2 Get Course Details & Curriculum
- **Method**: `GET`
- **Endpoint**: `/api/public/courses/:slug`
- **Access**: Public
- **Security Note**: Lessons conceal `bunnyVideoId`. Only title, duration, module, and order are exposed.
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "609...",
      "title": "Mastering Node.js",
      "slug": "mastering-nodejs",
      "description": "Comprehensive course...",
      "price": 1999
    },
    "modules": [
      {
        "name": "Module 1: Foundations",
        "lessons": [
          {
            "_id": "60a...",
            "title": "Event Loop Deep Dive",
            "durationSeconds": 600,
            "order": 1
          }
        ]
      }
    ],
    "isEnrolled": false
  }
}
```

### 3.3 List Approved Teachers
- **Method**: `GET`
- **Endpoint**: `/api/public/teachers`
- **Access**: Public
- **Security Note**: Only teachers where `isActive: true` and `teacherProfile.isApproved: true` appear.

### 3.4 Get Public Teacher Profile & Storefront
- **Method**: `GET`
- **Endpoint**: `/api/public/teachers/:id`
- **Access**: Public
- **Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "teacher": {
      "id": "608...",
      "name": "Jane Teacher",
      "headline": "Lead Backend Architect",
      "bio": "10+ years in distributed systems..."
    },
    "courses": [
      {
        "id": "609...",
        "title": "Mastering Node.js",
        "slug": "mastering-nodejs",
        "price": 1999
      }
    ]
  }
}
```

---

## 4. Teacher API (`/api/teacher`)

All endpoints in this group require:
1. Active session.
2. `req.session.user.role === "teacher"`.
3. `teacherProfile.isApproved === true`.
4. `isActive === true`.

### 4.1 Get Own Teacher Profile
- **Method**: `GET`
- **Endpoint**: `/api/teacher/profile`
- **Response** (HTTP 200): Includes approval status, headline, bio, payout UPI ID, and assigned commission rate.

### 4.2 Update Permitted Profile Fields
- **Method**: `PATCH`
- **Endpoint**: `/api/teacher/profile`
- **Headers**: `x-csrf-token: <csrfToken>`
- **Permitted Fields**: `headline`, `bio`, `payoutUpiId`, `payoutBankDetails`.
- **Blocked Fields**: `role`, `isApproved`, `commissionRate`, `isActive` (attempts to modify return 400).

### 4.3 List Own Courses
- **Method**: `GET`
- **Endpoint**: `/api/teacher/courses`
- **Scoping**: Strictly filtered by `ownerId: req.session.user.id`.

### 4.4 Create Course
- **Method**: `POST`
- **Endpoint**: `/api/teacher/courses`
- **Headers**: `x-csrf-token: <csrfToken>`
- **Request Body**:
```json
{
  "title": "Advanced Express Patterns",
  "description": "Production architecture and testing",
  "price": 2499
}
```
- **Security Guarantee**: `ownerId` is derived strictly from `req.session.user.id`. Any incoming `ownerId` or `teacherId` in the body is discarded.

### 4.5 Get / Update / Delete Own Course
- **Endpoints**:
  - `GET /api/teacher/courses/:id`
  - `PATCH /api/teacher/courses/:id`
  - `DELETE /api/teacher/courses/:id`
- **Security Guarantee**: If `course.ownerId !== req.session.user.id`, server responds with HTTP 403 `FORBIDDEN`. Deletion is blocked if course has active payments or enrollments.

### 4.6 Toggle Course Publication
- **Method**: `POST`
- **Endpoint**: `/api/teacher/courses/:id/toggle-publication`
- **Headers**: `x-csrf-token: <csrfToken>`

### 4.7 Lesson CRUD (Parent-Scoped)
- **Endpoints**:
  - `GET /api/teacher/courses/:courseId/lessons`
  - `POST /api/teacher/courses/:courseId/lessons`
  - `PATCH /api/teacher/courses/:courseId/lessons/:lessonId`
  - `DELETE /api/teacher/courses/:courseId/lessons/:lessonId`
- **Security Guarantee**: Before any lesson read or write, the parent course is queried. If `course.ownerId !== req.session.user.id`, the request is immediately rejected with HTTP 403 `FORBIDDEN`.

### 4.8 View Enrolled Students
- **Method**: `GET`
- **Endpoint**: `/api/teacher/students`
- **Query Parameters**: `courseId` (optional)
- **Scoping**: Only returns students who hold an enrollment in courses owned by the authenticated teacher.

### 4.9 View Student Progress
- **Method**: `GET`
- **Endpoint**: `/api/teacher/courses/:courseId/students/:studentId/progress`
- **Security Guarantee**: If `:courseId` is not owned by the teacher, returns HTTP 403 `FORBIDDEN`.

---

## 5. Student API (`/api/student`)

All endpoints require active session with `role === "student"`.

### 5.1 Get Own Profile
- **Method**: `GET`
- **Endpoint**: `/api/student/profile`

### 5.2 Update Permitted Profile Fields
- **Method**: `PATCH`
- **Endpoint**: `/api/student/profile`
- **Permitted Fields**: `name`, `phone`.

### 5.3 Get Student Dashboard
- **Method**: `GET`
- **Endpoint**: `/api/student/dashboard`
- **Response** (HTTP 200): Lists active and pending enrolled courses with completion percentages.

### 5.4 Get Enrolled Course Details
- **Method**: `GET`
- **Endpoint**: `/api/student/courses/:courseId`
- **Access**: Requires active enrollment for the course.

### 5.5 Get Lesson Playback & Signed URL
- **Method**: `GET`
- **Endpoint**: `/api/student/courses/:courseId/lessons/:lessonId/playback`
- **Security Architecture**:
  - Verifies active enrollment or super_admin role.
  - Verifies Bunny video ID.
  - Generates HMAC-SHA256 signed embed URL with 4-hour expiration.
  - Attaches dynamic anti-piracy watermark text (`Student Name | Email | Timestamp`).
  - **Zero credential leakage**: Never exposes Bunny Library ID or API secret key.

### 5.6 Save Playback Progress
- **Method**: `POST`
- **Endpoint**: `/api/student/progress`
- **Headers**: `x-csrf-token: <csrfToken>`
- **Request Body**:
```json
{
  "courseId": "609...",
  "lessonId": "60a...",
  "watchedSeconds": 320,
  "completed": false
}
```

### 5.7 Submit Payment Proof
- **Method**: `POST`
- **Endpoint**: `/api/student/payments/submit`
- **Headers**: `x-csrf-token: <csrfToken>`
- **Request Body**:
```json
{
  "courseId": "609...",
  "transactionReference": "UPI98765432100",
  "proofUrl": "https://drive.google.com/file/d/..."
}
```
- **Security Guarantee**: `amount` and `ownerId` are derived strictly from the database course record. The payment is created with `status: "pending"`. The student's enrollment is set to `pending`. Access remains blocked until Super Admin approval.

---

## 6. Super Admin API (`/api/admin`)

Requires `role === "super_admin"`.

### 6.1 Teacher Management
- `GET /api/admin/teachers`: List all teachers with pagination, status, and earnings metadata.
- `GET /api/admin/teachers/:id`: View detailed teacher profile.
- `POST /api/admin/teachers`: Provision a new teacher (requires `name`, `email`, `temporaryPassword`, `commissionRate`).
- `POST /api/admin/teachers/:id/approve`: Set `teacherProfile.isApproved: true`.
- `POST /api/admin/teachers/:id/toggle-status`: Suspend or reactivate teacher (`isActive`).

### 6.2 Course Management
- `GET /api/admin/courses`: List all courses across the entire platform.
- `POST /api/admin/courses`: Create platform course (`ownerId: null`).
- `POST /api/admin/courses/:id/toggle-publication`: Publish/unpublish any course.
- `DELETE /api/admin/courses/:id`: Delete course (with deletion safety guards).

### 6.3 Student & Enrollment Management
- `GET /api/admin/students`: List and search students.
- `GET /api/admin/students/:id`: View student profile and enrollment history.
- `PATCH /api/admin/enrollments/:id/status`: Update enrollment status (`active`, `revoked`).

### 6.4 Payment Management & Approval
- `GET /api/admin/payments`: List payments with filtering (`status`, `courseId`).
- `GET /api/admin/payments/:id`: View payment details and proof.
- `POST /api/admin/payments/:id/approve`:
  - Centralized via `services/paymentService.js`.
  - Calculates and freezes immutable `financialSnapshot` (distinguishing platform-owned 100% platform share vs teacher-owned courses with agreed commission rate).
  - Activates student enrollment atomically.
- `POST /api/admin/payments/:id/reject`: Rejects payment with reason and notifies student.
