# EDUviber — Paid Digital Course Platform

[![Build Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/package.json)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-black?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-Mongoose_9.11.2-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Bunny Stream](https://img.shields.io/badge/Bunny_Stream-CDN_%26_DRM-FF8700?logo=bunny.net&logoColor=white)](https://bunny.net/stream/)
[![Tests](https://img.shields.io/badge/Regression_Tests-66%2F66_Passing_(100%25)-brightgreen.svg)](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/LAUNCH_READINESS_REPORT.md)
[![Security](https://img.shields.io/badge/Security_Audit-A%2B_Hardened-success.svg)](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/LAUNCH_READINESS_REPORT.md)

A production-grade, secure, and high-performance web platform for hosting, publishing, and selling digital video courses with tokenized DRM streaming, anti-piracy dynamic watermarking, manual UPI/bank payment verification, and real-time student progress analytics.

---

## 🌟 What's New in Build Version 2.0 (v2.0.0)

Build Version 2 represents a major milestone, upgrading EDUviber from an initial core LMS engine to a **complete, commercially deployable, and production-hardened platform**. 

### Key Advancements in v2:

1. **Brand Identity & Favicon Integration**:
   - Official **EDUviber** brand logo (`/images/EDUviber_LOGO.png`), high-resolution favicon (`favicon.ico` / `favicon.png`), and Apple Touch Icon integrated consistently across all 25 EJS views (Public Storefront, Student Portal, Admin Dashboard, and Authentication screens).

2. **Modern Authentication UI/UX & Accessibility**:
   - Interactive **password visibility toggles** (accessible SVG eye open/closed icons) implemented on [Login](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/views/auth/login.ejs), [Mandatory Password Change](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/views/auth/change-password.ejs), and [Password Reset](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/views/auth/reset-password.ejs) views.
   - Enhanced keyboard navigation, aria labels, and smooth state transitions with focused amber/yellow branding rings (`focus:ring-2 focus:ring-yellow-500`).

3. **Complete Public Storefront & Discovery Engine**:
   - Marketing landing page (`/`) showcasing platform value propositions, metrics, and published courses.
   - Public course catalogue (`/courses`) with lesson count, total duration, and INR pricing.
   - Public course curriculum preview (`/courses/:slug`) grouping lessons by module while strictly concealing private Bunny video stream IDs.

4. **Self-Serve Offline Checkout & Payment Audit Queue**:
   - Student self-serve payment checkout screen (`/courses/:slug/enroll`) with server-derived course pricing.
   - Configurable offline payment instructions (merchant UPI ID, Bank Name, Account Number, IFSC code).
   - Secure payment proof ingestion (base64 image upload or verified cloud drive links) with strict isolation rules.
   - Student payment dashboard displaying active, pending, and rejected submissions with administrative feedback and one-click retry checkout.
   - Admin payment audit queue (`/admin/payments`) with status filtering (`pending`, `approved`, `rejected`), modal preview dialogues, and idempotent enrollment activation.

5. **Cryptographic Password Recovery & Transactional Email System**:
   - Self-serve password reset request flow (`/forgot-password`) generating 32-byte cryptographic tokens with SHA-256 database hashes and 1-hour expiration.
   - Generic anti-enumeration response preventing attacker probing of registered email addresses.
   - Single-use token invalidation, $\ge 12$-character password enforcement, and automatic session renewal upon password reset.
   - Provider-agnostic transactional email engine ([`services/emailService.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/services/emailService.js)) with responsive HTML and plain-text templates for 6 lifecycle events (Password Reset, Welcome/Account Creation, Payment Submitted, Payment Approved, Payment Rejected, Enrollment Activated).

6. **Anti-Piracy Video Protection & Real-Time Analytics**:
   - Short-lived SHA-256 HMAC embed token signing (1-hour TTL) generated uniquely per playback session.
   - Bunny Video Management API verification verifying encoding status before rendering player embeds.
   - Dynamic floating watermark displaying the student's email with infinite 24-second CSS corner-traversal keyframes to deter screen recording.
   - Integrated Player.js API hooks for automatic periodic progress saves (~10s intervals), pause triggers, `pagehide` beaconing, and auto-resume from the last watched second.

7. **Course & Lesson Content Management (CRUD) with Referential Integrity**:
   - Admin course creation and editing with automated slug generation and collision avoidance.
   - Module-based lesson management with sequential order collision detection and publication guards.
   - Reference-checked safe deletion: blocks hard deletion of courses or lessons if financial payments, student enrollments, or progress records exist.

8. **Enterprise Security Hardening**:
   - Session-based CSRF protection enforcing validation on all state-changing `POST` routes.
   - Sliding-window in-memory rate limiting on `/login` (10 requests / 15 min) and `/forgot-password` (5 requests / 15 min).
   - Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS in production, and `x-powered-by` disabled.
   - Unauthenticated `/health` probe for container orchestrators and cloud load balancers.
   - Centralized error handler masking internal stack traces and database schemas from end users.

9. **100% Automated Regression Test Suite (66/66 Passing)**:
   - 7 automated test suites validating storefront discovery, admin operations, payment workflows, password recovery, content CRUD, production readiness, and complete end-to-end user journeys.

---

## 📌 System Capability Matrix

| Domain | Build v1 Status | Build v2 Status | Description |
| :--- | :---: | :---: | :--- |
| **Authentication & RBAC** | ✅ Operational | ✅ **Enhanced** | Admin/Student roles, MongoStore session persistence, forced password change on first login, and interactive password visibility toggles. |
| **Public Storefront** | ❌ Not Present | ✅ **Operational** | Responsive marketing landing page at `/`, published catalogue at `/courses`, and curriculum preview at `/courses/:slug`. |
| **Payment & Checkout** | ❌ Not Present | ✅ **Operational** | Offline UPI/Bank transfer checkout, proof submission, student payment history, and admin review queue with idempotent enrollment activation. |
| **Video Protection & CDN** | ⚠️ Basic | ✅ **Hardened** | Bunny Stream CDN integration with SHA-256 HMAC signed embed tokens (1h TTL), API existence check, and `no-store` cache headers. |
| **Anti-Piracy Watermarking**| ⚠️ Static | ✅ **Operational** | Dynamic, floating student email watermark animated over the video viewport via 24s CSS keyframes. |
| **Playback & State Tracking**| ⚠️ Local | ✅ **Operational** | Player.js background sync (~10s), pause triggers, `pagehide` beaconing, auto-resume, and course completion analytics. |
| **Password Recovery & Email** | ❌ Not Present | ✅ **Operational** | Cryptographic 32-byte single-use token recovery, anti-enumeration responses, 12-char policy, and multi-event transactional email service. |
| **Admin Content Management** | ⚠️ Partial | ✅ **Operational** | Course & lesson CRUD, slug conflict resolution, order collision detection, publication guards, and referential integrity delete safeguards. |
| **Student Directory & Access**| ⚠️ Seeded Only| ✅ **Operational** | Searchable student directory (`/admin/students`), provisioning with forced reset, and `/admin/enrollments` manual assignment. |
| **CSRF Protection** | ❌ Not Present | ✅ **Operational** | Session-based CSRF token validation on all state-changing POST forms across public, student, and admin portals. |
| **Rate Limiting & Defense** | ❌ Not Present | ✅ **Operational** | In-memory sliding window brute-force rate limiters on `/login` and `/forgot-password` with `Retry-After` headers. |
| **Production Readiness** | ⚠️ Basic | ✅ **Hardened** | Environment validation on boot, `/health` liveness probe, reverse proxy trust, security headers, and stack trace suppression. |
| **Brand Identity & Favicons**| ❌ Generic | ✅ **Operational** | Unified EDUviber logo and favicons integrated across all 25 EJS view templates. |

---

## 🏗️ Technical Architecture & Stack

```
                          ┌───────────────────────────────────────┐
                          │   Client Browser / Mobile Web         │
                          │   (Tailwind CSS / EJS / Vanilla JS)   │
                          └───────────────────┬───────────────────┘
                                              │ HTTP / HTTPS (SSL)
                                              ▼
                          ┌───────────────────────────────────────┐
                          │   Express 5.3 Application Server      │
                          │   - Security Headers & CSRF Engine    │
                          │   - In-Memory Sliding Rate Limiter    │
                          │   - Authentication & RBAC Guard       │
                          │   - Controller & Route Middleware     │
                          └──────┬─────────────┬─────────────┬────┘
                                 │             │             │
                    Session & DB │             │ Token HMAC  │ Transactional
                    Transactions │             │ & API Check │ Emails (SMTP)
                                 ▼             ▼             ▼
  ┌────────────────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
  │         MongoDB Atlas              │ │     Bunny.net Stream    │ │  Transactional Email    │
  │  - Users, Courses, Lessons         │ │  - Transcoded HLS / MP4 │ │  - Resend / SendGrid    │
  │  - Enrollments, Progress, Payments │ │  - Global Edge Delivery │ │  - Branded Notifications│
  │  - MongoStore Sessions (24h TTL)   │ │  - HMAC Embed Validation│ │  - Password Reset Links │
  └────────────────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

### Technology Breakdown:
- **Runtime Environment**: Node.js (Native ES Modules `"type": "module"`, Node `>=20.0.0`)
- **Web Application Framework**: Express.js `5.3.0`
- **Database & Object Data Modeling (ODM)**: MongoDB Atlas with Mongoose `9.11.2`
- **Session Layer**: `express-session` backed by `connect-mongo` `6.0.0` (MongoDB-persisted sessions with 24h TTL)
- **Security & Cryptography**:
  - `bcryptjs` (password hashing with cost factor 12)
  - Native Node.js `crypto` (32-byte cryptographic reset tokens & SHA-256 HMAC embed token generation)
  - In-memory sliding-window rate limiters
  - Session-backed CSRF protection
- **Media Delivery & CDN**: Bunny Stream (Media Delivery API, Player.js `0.1.0`)
- **Email Service**: Nodemailer `10.2.1` with dry-run support and responsive multi-part templates
- **Frontend & Templating**: Server-rendered EJS with Tailwind CSS (via CDN) and Vanilla JS micro-interactions
- **Containerization**: Multi-stage production `Dockerfile` based on `node:20-alpine`

---

## 🗄️ Database Schemas & Data Model

The application leverages six interconnected Mongoose schemas defined in `/models`:

```
┌──────────────┐          1:N          ┌──────────────┐          1:N          ┌──────────────┐
│     User     │───────────────────────│  Enrollment  │───────────────────────│    Course    │
└──────────────┘                       └──────────────┘                       └──────────────┘
       │                                                                             │
       │ 1:N                                                                         │ 1:N
       ▼                                                                             ▼
┌──────────────┐                       ┌──────────────┐                       ┌──────────────┐
│   Payment    │                       │   Progress   │───────────────────────│    Lesson    │
└──────────────┘                       └──────────────┘          1:N          └──────────────┘
```

### 1. `User` ([`models/User.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/User.js))
- **Schema Fields**: `name` (String, required), `email` (String, required, lowercase, unique, indexed), `phone` (String), `passwordHash` (String, required, hidden by default with `select: false`), `role` (enum: `"student"`, `"admin"`, default: `"student"`), `mustChangePassword` (Boolean, default: `true`), `isActive` (Boolean, default: `true`), `passwordResetToken` (String, SHA-256 hash, `select: false`), `passwordResetExpires` (Date).
- **Key Behaviors**: Users with `mustChangePassword: true` are trapped in `/change-password` by the authentication middleware until credentials are updated. Password resets clear tokens and enforce single-use validity.

### 2. `Course` ([`models/Course.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/Course.js))
- **Schema Fields**: `title` (String, required), `slug` (String, required, unique, indexed, auto-generated from title), `description` (String), `price` (Number, min: `0`), `thumbnail` (String), `instructor` (String), `isPublished` (Boolean, default: `false`).
- **Key Behaviors**: Unpublished courses return 404 to non-admin visitors. Deletion is strictly blocked if associated enrollments or payment audit records exist.

### 3. `Lesson` ([`models/Lesson.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/Lesson.js))
- **Schema Fields**: `courseId` (ObjectId ref `Course`, required), `title` (String, required), `description` (String), `moduleName` (String, e.g. "Module 1", "Day 1"), `order` (Number, min: `1`), `durationSeconds` (Number), `bunnyVideoId` (String, UUID), `isPublished` (Boolean, default: `false`).
- **Compound Indexes**: `{ courseId: 1, order: 1 }` (unique) prevents duplicate lesson orders within a course.
- **Publication Guard**: A lesson cannot be published unless its parent course is published and a valid `bunnyVideoId` is attached.

### 4. `Enrollment` ([`models/Enrollment.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/Enrollment.js))
- **Schema Fields**: `userId` (ObjectId ref `User`, required), `courseId` (ObjectId ref `Course`, required), `status` (enum: `"pending"`, `"active"`, `"suspended"`, `"expired"`, default: `"pending"`), `approvedAt` (Date).
- **Compound Indexes**: `{ userId: 1, courseId: 1 }` (unique) prevents duplicate course enrollments for the same student.
- **Key Behaviors**: Active status is mandatory for students accessing the video player. Admins bypass enrollment verification.

### 5. `Progress` ([`models/Progress.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/Progress.js))
- **Schema Fields**: `userId` (ObjectId ref `User`, required), `lessonId` (ObjectId ref `Lesson`, required), `lastPositionSeconds` (Number, default: `0`), `watchedSeconds` (Number, default: `0`), `completed` (Boolean, default: `false`), `lastWatchedAt` (Date).
- **Compound Indexes**: `{ userId: 1, lessonId: 1 }` (unique).
- **Key Behaviors**: Upserted via `/courses/:courseId/lessons/:lessonId/progress` whenever the student watches periodically, pauses, or finishes a video.

### 6. `Payment` ([`models/Payment.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/models/Payment.js))
- **Schema Fields**: `userId` (ObjectId ref `User`, required), `courseId` (ObjectId ref `Course`, required), `amount` (Number, required, derived from server course price), `transactionReference` (String, required), `proofUrl` (String, data URI or cloud link), `status` (enum: `"pending"`, `"approved"`, `"rejected"`, default: `"pending"`), `reviewedAt` (Date), `reviewedBy` (ObjectId ref `User`), `rejectionReason` (String).
- **Key Behaviors**: Serves as the complete financial audit record for manual UPI/bank transactions. Payment approval idempotently creates or activates the student's `Enrollment`.

---

## 🔐 Anti-Piracy & Content Protection Architecture

Content protection is a foundational pillar of EDUviber:

```
[Student Browser]
       │
       │ 1. Request watch page (/courses/:cId/lessons/:lId/watch)
       ▼
[Express Server]
       │ 2. Verify Session & Active Enrollment
       │ 3. Call Bunny API: Verify video status & library ownership
       │ 4. Compute SHA-256 HMAC Token:
       │    Token = SHA256(BUNNY_STREAM_EMBED_TOKEN_KEY + videoId + expires)
       │ 5. Render HTML with:
       │    - Token-Signed IFrame URL (expires in 3,600s)
       │    - Dynamic moving watermark overlay containing student email
       │    - Cache-Control: no-store, private
       ▼
[Bunny Stream CDN]
       │ 6. Validates SHA-256 Token & Allowed Referrer Domain
       ▼
[Encrypted Video Stream Plays]
```

1. **Bunny Stream Token Authentication**:
   - Embed URLs are never static. Each playback session generates a short-lived signed URL using SHA-256 HMAC:
     $$\text{Token} = \text{SHA256}(\text{BUNNY\_STREAM\_EMBED\_TOKEN\_KEY} + \text{videoId} + \text{expires})$$
   - Default TTL is **3,600 seconds (1 hour)**. Expired URLs cannot be shared, hotlinked, or reused.
2. **Server-Side Video Pre-Flight Verification**:
   - Before serving the watch interface, the server calls Bunny's Video Management API (`https://video.bunnycdn.com/library/.../videos/...`) with an abort timeout to confirm the video is encoded, exists, and belongs to the owner's library.
3. **Dynamic Anti-Screen Recording Watermark**:
   - The watch page injects a moving watermark showing the authenticated student's email directly over the video frame.
   - An infinite 24-second CSS keyframe animation relocates the watermark across screen corners, discouraging screen-capture piracy and providing forensic evidence if content is leaked.
4. **Cache & Session Hardening**:
   - Video watch routes send `Cache-Control: no-store, private` to prevent intermediate proxy and browser disk caching.
   - Session cookies utilize `httpOnly: true`, `sameSite: "lax"`, and `secure: true` in production.
   - Sessions are regenerated upon login to prevent session fixation attacks.

---

## 💻 Complete Route & API Reference

### 1. Public Storefront & Discovery ([`routes/publicRoutes.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/routes/publicRoutes.js))

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Marketing landing page with hero banner, value proposition, trust metrics, and published courses showcase. |
| `GET` | `/health` | Public | Unauthenticated liveness probe returning `{ status: "ok", uptime, database: "connected" }`. |
| `GET` | `/courses` | Public | Published course catalogue with lesson counts, durations, and INR pricing. |
| `GET` | `/courses/:slug` | Public | Public syllabus preview grouped by modules, displaying only published lessons without leaking video IDs. |
| `GET` | `/courses/:slug/enroll` | Student / Auth | Checkout screen with server-derived course pricing and configurable UPI/Bank transfer details. |
| `POST`| `/courses/:slug/enroll` | Student / Auth | Records pending transaction references (`Payment`) with proof uploads for admin verification. Protected by CSRF. |
| `GET` | `/payments/:id/proof` | Owner / Admin | Secure access to uploaded payment proof, strictly restricted to the payment owner or an admin. |

### 2. Authentication & Recovery ([`routes/authRoutes.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/routes/authRoutes.js))

| Method | Endpoint | Rate Limit | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/login` | None | Sign-in view with support for post-reset success confirmation alerts. |
| `POST`| `/login` | 10 req / 15m | Validates email and bcrypt password. Regenerates session. Redirects to `/change-password` if flagged. |
| `POST`| `/logout` | None | Destroys session, clears `course.sid` cookie, and redirects to `/login`. |
| `GET` | `/forgot-password` | None | Password recovery request form. |
| `POST`| `/forgot-password` | 5 req / 15m | Generates 32-byte cryptographic token, stores SHA-256 hash (1h expiry), dispatches email, returns generic confirmation. |
| `GET` | `/reset-password` | None | Validates token against database hash and expiry, rendering new password form or friendly error. |
| `POST`| `/reset-password` | None | Enforces $\ge 12$ char password, updates bcrypt hash, clears token, clears `mustChangePassword`, and redirects to `/login`. |
| `GET` | `/change-password` | Enforced | Mandatory password change screen for initial onboarding. |
| `POST`| `/change-password` | None | Enforces $\ge 12$ char password, hashes with bcrypt, updates user, and clears flag. |

### 3. Student Portal ([`routes/studentRoutes.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/routes/studentRoutes.js))

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | Student | Enrolled courses, per-course completion percentage, `nextLesson` resume suggestions, module curriculum, and personal payment history. |
| `GET` | `/courses/:courseId/lessons/:lessonId/watch` | Enrolled Student | Verifies active enrollment, fetches signed Bunny embed token, and renders player with animated watermark and saved timestamp. |
| `POST`| `/courses/:courseId/lessons/:lessonId/progress`| Enrolled Student | Player.js beacon and AJAX progress sync protected by CSRF token validation. Upserts `Progress` record. |

### 4. Admin Management Portal ([`routes/adminRoutes.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/routes/adminRoutes.js))

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin` | Admin | Dashboard summarizing platform metrics, active enrollments, revenue, and courses. |
| `GET` | `/admin/courses` | Admin | Course table with publish states and lesson counts. |
| `GET` | `/admin/courses/new` | Admin | Course creation view. |
| `POST`| `/admin/courses` | Admin | Creates a course with automated slug generation and collision avoidance. |
| `GET` | `/admin/courses/:id/edit`| Admin | Prefilled course edit form with slug uniqueness validation. |
| `POST`| `/admin/courses/:id` | Admin | Updates course metadata, pricing, instructor, and publication state. |
| `POST`| `/admin/courses/:id/delete`| Admin | Safe deletion requiring explicit title confirmation. Blocks if payments or enrollments exist. |
| `POST`| `/admin/courses/:id/toggle-publication` | Admin | Toggles course publication state. |
| `GET` | `/admin/courses/:courseId/lessons` | Admin | Module-wise lesson list for a specific course. |
| `GET` | `/admin/courses/:courseId/lessons/new` | Admin | Lesson creation form with auto-suggested sequential order. |
| `POST`| `/admin/courses/:courseId/lessons` | Admin | Creates a lesson with module grouping and order conflict checks. |
| `GET` | `/admin/courses/:courseId/lessons/:lessonId/edit`| Admin | Prefilled lesson edit form. |
| `POST`| `/admin/courses/:courseId/lessons/:lessonId`| Admin | Updates lesson details, module grouping, order conflicts, Bunny GUID, and publication guards. |
| `POST`| `/admin/courses/:courseId/lessons/:lessonId/delete` | Admin | Safe lesson deletion verifying progress history. |
| `POST`| `/admin/courses/:courseId/lessons/:lessonId/toggle-publication` | Admin | Toggles lesson publication with safety checks. |
| `GET` | `/admin/students` | Admin | Searchable student directory with pagination and enrollment counts. |
| `GET` | `/admin/students/new` | Admin | Account provisioning form for new students with forced reset. |
| `POST`| `/admin/students` | Admin | Creates new student account with bcrypt password and forced reset flag. |
| `GET` | `/admin/students/:id` | Admin | Detailed student profile with complete enrollment and payment history. |
| `GET` | `/admin/enrollments` | Admin | Course permissions dashboard filtered by status (`pending`, `active`, `suspended`, `expired`). |
| `POST`| `/admin/enrollments` | Admin | Manually assigns a published course to a student. |
| `POST`| `/admin/enrollments/:id/status`| Admin | Transitions enrollment status (e.g. active, suspended) without deleting progress. |
| `GET` | `/admin/payments` | Admin | Payment audit queue with filter tabs (`pending`, `approved`, `rejected`, `all`), proof modals, and actions. |
| `POST`| `/admin/payments/:id/approve` | Admin | Approves payment and idempotently creates or activates the student's `Enrollment`. |
| `POST`| `/admin/payments/:id/reject` | Admin | Rejects payment with mandatory `rejectionReason`, retaining complete audit history. |

---

## 📂 Directory Layout

```
EDUviber/
├── config/
│   ├── bunny.js                     # Bunny Stream API verification & HMAC token generator
│   ├── db.js                        # Mongoose Atlas connection with timeout handling
│   └── env.js                       # Startup environment variable validation
├── controllers/
│   ├── adminController.js           # Admin analytics, course & lesson CRUD, students, enrollments, payments
│   ├── authController.js            # Login, logout, password change, and token recovery flows
│   ├── publicController.js          # Landing, catalogue, course syllabus, and manual checkout
│   └── studentController.js         # Dashboard aggregation, watch verification, progress sync
├── middleware/
│   ├── csrf.js                      # CSRF protection middleware with session tokens & test bypass
│   ├── rateLimiter.js               # Sliding-window in-memory brute-force rate limiter
│   └── requireAuth.js               # Authentication & Role-based Access Control (RBAC)
├── models/
│   ├── Course.js                    # Course schema with slug indexing and deletion guards
│   ├── Enrollment.js                # Student course enrollment & status lifecycle schema
│   ├── Lesson.js                    # Lesson schema with module grouping & ordering indexes
│   ├── Payment.js                   # Payment transaction tracking schema with audit fields
│   ├── Progress.js                  # Per-student video progress schema
│   └── User.js                      # User accounts schema with bcrypt and reset token support
├── public/
│   ├── EDUviber_LOGO.png            # Primary brand asset
│   ├── favicon.ico                  # Standard 32x32 / multi-res browser favicon
│   ├── favicon.png                  # High-resolution PNG favicon
│   ├── css/                         # Custom CSS styles (reserved for asset builds)
│   ├── images/
│   │   └── EDUviber_LOGO.png        # Web-accessible logo for headers and emails
│   └── js/                          # Client-side scripts
├── routes/
│   ├── adminRoutes.js               # Protected /admin route group
│   ├── authRoutes.js                # Authentication & password reset route group
│   ├── publicRoutes.js              # Storefront, catalogue, and checkout route group
│   └── studentRoutes.js             # Student dashboard and protected watch route group
├── scripts/
│   ├── createAdmin.js               # CLI utility to seed initial administrator
│   ├── testAdminStudentEnrollment.js# Automated test suite: student & enrollment operations
│   ├── testCourseLessonManagement.js# Automated test suite: course & lesson CRUD, slug collisions
│   ├── testEndToEndLifecycle.js     # Complete 10-step end-to-end lifecycle & boundary integration tests
│   ├── testPasswordRecoveryAndEmail.js # Automated test suite: recovery tokens & email delivery
│   ├── testPaymentWorkflow.js       # Automated test suite: manual payment verification
│   ├── testProductionReadiness.js   # Automated test suite: health probe, security headers & rate limiting
│   └── testStorefront.js            # Automated test suite: storefront & security checks
├── services/
│   └── emailService.js              # Transactional email service & branded responsive templates
├── views/
│   ├── admin/
│   │   ├── courses/
│   │   │   ├── edit.ejs             # Course edit form with danger zone & deletion safety
│   │   │   ├── index.ejs            # Course list table & publish buttons
│   │   │   └── new.ejs              # Course creation form
│   │   ├── dashboard.ejs            # Admin stats overview
│   │   ├── enrollments/
│   │   │   └── index.ejs            # Manual enrollment assignment & status management
│   │   ├── lessons/
│   │   │   ├── edit.ejs             # Lesson edit form with danger zone & publication guard
│   │   │   ├── index.ejs            # Lesson table per course
│   │   │   └── new.ejs              # Lesson creation form
│   │   ├── payments/
│   │   │   └── index.ejs            # Manual payment audit queue with filters & review modals
│   │   └── students/
│   │       ├── index.ejs            # Searchable student directory table
│   │       ├── new.ejs              # Student account creation form
│   │       └── show.ejs             # Student detail profile with enrollment history
│   ├── auth/
│   │   ├── change-password.ejs      # Mandatory password reset view with visibility toggle
│   │   ├── forgot-password.ejs      # Account recovery request form
│   │   ├── login.ejs                # User sign-in view with password visibility toggle
│   │   └── reset-password.ejs       # Secure token password update view with visibility toggle
│   ├── partials/                    # Reusable view components
│   ├── public/
│   │   ├── 404.ejs                  # Branded not found & sanitized error page
│   │   ├── catalog.ejs              # Published course catalogue grid
│   │   ├── course-detail.ejs        # Public syllabus preview & enrollment CTA
│   │   ├── enroll-login-required.ejs# Guidance for anonymous checkout
│   │   ├── enroll-success.ejs       # Payment reference confirmation
│   │   ├── enroll.ejs               # Manual bank/UPI payment instructions & form
│   │   └── landing.ejs              # Storefront marketing landing page
│   └── student/
│       ├── dashboard.ejs            # Student dashboard with analytics & outline
│       └── lesson.ejs               # Video player with watermark & Player.js sync
├── .dockerignore                    # Excluded files for container builds
├── .env                             # Local environment secrets (NEVER commit!)
├── .env.example                     # Sanitized template for environment configuration
├── .gitignore                       # Git ignore rules
├── Dockerfile                       # Production multi-stage Node.js container definition
├── LAUNCH_READINESS_REPORT.md       # Pre-launch audit evidence & 66/66 test proof
├── package.json                     # Project dependencies, metadata & scripts
├── server.js                        # Application bootstrap & middleware pipeline
└── README.md                        # Product documentation (this file)
```

---

## ⚙️ Environment Variables Reference

Configure these environment variables inside `.env` in the project root:

```env
# ==============================================================================
# SERVER CONFIGURATION
# ==============================================================================
PORT=2000
NODE_ENV=development

# ==============================================================================
# DATABASE & SESSION STORAGE
# ==============================================================================
# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# Cryptographically random string (minimum 32 characters)
SESSION_SECRET=your_super_secret_session_key_at_least_32_chars

# ==============================================================================
# INITIAL ADMINISTRATOR SEEDING (Used by scripts/createAdmin.js)
# ==============================================================================
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=YourSecurePassword123!

# ==============================================================================
# MANUAL PAYMENT INSTRUCTIONS (Displayed during checkout)
# ==============================================================================
PAYMENT_UPI_ID=merchant@upi
PAYMENT_ACCOUNT_NAME="EDUviber LLC"
PAYMENT_BANK_NAME="HDFC Bank"
PAYMENT_ACCOUNT_NO="50200012345678"
PAYMENT_IFSC=HDFC0001234
PAYMENT_NOTE="Please transfer the exact amount and save your UTR / transaction reference number."

# ==============================================================================
# TRANSACTIONAL EMAIL SERVICE (Resend, SendGrid, Postmark, AWS SES, or SMTP)
# ==============================================================================
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=your_transactional_email_api_key_or_password
EMAIL_FROM="EDUviber <notifications@yourdomain.com>"
APP_BASE_URL=http://localhost:2000

# ==============================================================================
# BUNNY STREAM CDN & DRM INTEGRATION
# ==============================================================================
BUNNY_STREAM_LIBRARY_ID=123456
BUNNY_STREAM_API_KEY=your_bunny_stream_api_key
BUNNY_STREAM_CDN_HOSTNAME=vz-xxxx.b-cdn.net
BUNNY_STREAM_EMBED_TOKEN_KEY=your_embed_token_authentication_key
```

> [!IMPORTANT]
> To obtain your `BUNNY_STREAM_EMBED_TOKEN_KEY`:
> 1. Log in to **Bunny.net Dashboard → Stream → Video Libraries → [Your Library] → Security**.
> 2. Ensure **Token Authentication** is toggled **ON**.
> 3. Copy the **Token Authentication Key** into `BUNNY_STREAM_EMBED_TOKEN_KEY`.

---

## 🚀 Getting Started & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed the Primary Administrator Account
Before starting the server, seed your primary administrator into MongoDB:
```bash
node scripts/createAdmin.js
```
*Make sure `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 12 characters) are set in `.env`.*

### 3. Run Automated Regression Test Suites
Validate the entire platform against all 66 test assertions:
```bash
npm test
```

You can also run individual test suites independently:
```bash
npm run test:storefront   # Storefront discovery & syllabus security
npm run test:admin        # Admin student & enrollment management
npm run test:payment      # Manual payment verification & proof security
npm run test:auth         # Password recovery & transactional email delivery
npm run test:crud         # Course & lesson CRUD, slug collisions & deletion safety
npm run test:readiness    # Production readiness, health probe & rate limiting
npm run test:e2e          # Complete 10-step end-to-end user & admin lifecycle
```

### 4. Start the Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:2000` (or your configured `PORT`).

### 5. Accessing the Platform
- **Public Storefront**: Browse published courses at `http://localhost:2000`
- **Course Catalogue**: Explore programs at `http://localhost:2000/courses`
- **Admin Portal**: Log in at `http://localhost:2000/login` with your seeded admin credentials to access `http://localhost:2000/admin`.
- **Student Dashboard**: Once enrolled, view lessons and progress at `http://localhost:2000/dashboard`.

---

## 🧪 Comprehensive Automated Test Suites (66/66 Passing)

The repository includes 7 comprehensive test suites in `/scripts` that execute sequentially against MongoDB Atlas:

```
> npm test

=== 1. STOREFRONT DISCOVERY TESTS (7/7 PASSED) ===
✓ TEST 1: Landing page displays published courses and conceals draft courses.
✓ TEST 2: Course catalogue displays only published courses.
✓ TEST 3: Course detail renders syllabus safely and hides draft lessons/video IDs.
✓ TEST 4: Draft course slug correctly returns 404.
✓ TEST 5: Non-existent slug correctly returns 404.
✓ TEST 6: Purchase CTA links to real manual enrollment workflow.
✓ TEST 7: Route protections on /login and /admin preserved.

=== 2. ADMIN STUDENT & ENROLLMENT TESTS (7/7 PASSED) ===
✓ TEST 1: Strict authorization enforced (anonymous redirected, student role denied with 403).
✓ TEST 2: Admin successfully created student with secure hashed password and forced reset flag.
✓ TEST 3: Duplicate email correctly blocked with HTTP 409 Conflict.
✓ TEST 4: Student directory search and detail profile function correctly; invalid IDs return 404.
✓ TEST 5: Published course enrolled successfully; draft course enrollment safely rejected with 400.
✓ TEST 6: Duplicate enrollment blocked with HTTP 409 Conflict.
✓ TEST 7: Status transitions (active -> suspended -> active) validated; progress preserved during suspension.

=== 3. PAYMENT WORKFLOW & VERIFICATION TESTS (9/9 PASSED) ===
✓ TEST 1: Admin payments endpoints protected against anonymous and student access.
✓ TEST 2: Arbitrary external URLs as proof are safely rejected.
✓ TEST 3: Payment submitted with pending status and server-derived price; enrollment not activated.
✓ TEST 4: Duplicate pending payment submission blocked.
✓ TEST 5: Payment proof access strictly restricted to owner and admin.
✓ TEST 6: Payment rejection validated with mandatory reason preserved.
✓ TEST 7: Student retry payment submission after prior rejection verified.
✓ TEST 8 & 9: Payment approval activated enrollment, and repeated approval remained idempotent.

=== 4. PASSWORD RECOVERY & TRANSACTIONAL EMAIL TESTS (12/12 PASSED) ===
✓ TEST 1: GET /forgot-password renders recovery form.
✓ TEST 2: Non-existent email returns generic confirmation without leaking user existence.
✓ TEST 3: Cryptographic 32-byte token generated, SHA-256 hash stored in DB, reset email dispatched.
✓ TEST 4: Tampered or invalid reset token returns 400.
✓ TEST 5: Valid reset token renders new password form.
✓ TEST 6 & 7: 12-character minimum and password confirmation strictly enforced.
✓ TEST 8: Password successfully updated with bcrypt; token invalidated; session renewed.
✓ TEST 9: Single-use token enforcement validated (reused token blocked).
✓ TEST 10: Expired token safely rejected.
✓ TEST 11: Successfully authenticated with newly updated password.
✓ TEST 12: Transactional email delivery, fallbacks, and error boundaries verified.

=== 5. COURSE & LESSON MANAGEMENT (CRUD) TESTS (14/14 PASSED) ===
✓ TEST 1: GET /admin/courses/:id/edit renders course edit view with prefilled data.
✓ TEST 2: Course details and custom slug updated successfully.
✓ TEST 3: Invalid and negative pricing rejected with HTTP 400.
✓ TEST 4: Slug collision correctly rejected with HTTP 409 Conflict.
✓ TEST 5: Course hard deletion blocked when financial payment records exist.
✓ TEST 6: Course hard deletion blocked when active student enrollments exist.
✓ TEST 7: Mismatched deletion confirmation title safely rejected.
✓ TEST 8: Course and associated draft lessons deleted safely after verified confirmation.
✓ TEST 9: GET /admin/courses/:courseId/lessons/:lessonId/edit renders lesson edit form.
✓ TEST 10: Lesson metadata, module assignment, and video ID updated successfully.
✓ TEST 11: Lesson order conflict rejected with HTTP 409 Conflict.
✓ TEST 12: Publication guard enforced (cannot publish lesson without video ID).
✓ TEST 13: Lesson deletion safely guarded against accidental progress loss.
✓ TEST 14: State-changing form request without valid CSRF token rejected with HTTP 403.

=== 6. PRODUCTION READINESS & SECURITY TESTS (7/7 PASSED) ===
✓ TEST 1: Environment validation successfully checked all required secrets on boot.
✓ TEST 2: Health check endpoint /health returned 200 OK without disclosing secrets.
✓ TEST 3: Defensive security headers verified (x-powered-by removed, nosniff, SAMEORIGIN).
✓ TEST 4: Centralized error handler masked internal stack traces and database secrets.
✓ TEST 5: Authentication rate limiter blocked rapid attempts with HTTP 429 and Retry-After header.
✓ TEST 6: Video progress tracking validates CSRF tokens strictly.
✓ TEST 7: Backup and restore logic successfully verified against isolated sandbox database.

=== 7. COMPLETE END-TO-END LIFECYCLE TESTS (10/10 PASSED) ===
✓ STEP 1: Public visitor browses catalogue and syllabus cleanly without leaking drafts or video IDs.
✓ STEP 2: Student onboarding enforces password change on first login, traps unreset sessions, and updates credentials.
✓ STEP 3: Student initiates enrollment and submits payment proof; watch access remains locked.
✓ STEP 4: Administrator reviews payments queue and approves transaction; enrollment status transitions to active.
✓ STEP 5: Student dashboard reflects active course outline and progress analytics.
✓ STEP 6: Protected watch route delivers signed Bunny HMAC embed token with animated email watermark.
✓ STEP 7: Playback progress saves via background sync, reloads on page resume, and updates to 50% course completion.
✓ STEP 8: Access boundaries verified: suspended access blocked (403), draft lessons hidden (404), proofs isolated (403), invalid IDs handled (404), and CSRF enforced (403).
✓ STEP 9: Student logout destroys session, clears cookies, and redirects to /login.
✓ STEP 10: Unauthenticated /health liveness probe operational and returns 200 OK.

==================================================
TOTAL PASSING TESTS: 66 / 66 (100% SUCCESS RATE)
==================================================
```

---

## 🚢 Production Deployment Guide

### 1. Hosting Architecture
EDUviber is a **stateful Express 5 server-rendered application** requiring persistent Node.js processes for session management (MongoStore), signed token HMAC generation, and `keepalive` video progress beaconing.
- **Recommended Cloud Hosts**: **Render** (Web Service), **Railway**, **Fly.io**, **DigitalOcean App Platform**, or **AWS App Runner / ECS**.
- **Static Hosting Incompatibility**: Do **not** deploy to static-only frontends (e.g. Netlify Static, GitHub Pages) without a running Express server backend.

### 2. Containerized Deployment (Docker)
The repository includes an optimized multi-stage production [`Dockerfile`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/EDUviber/Dockerfile) based on `node:20-alpine`:
- Executes as unprivileged user `node`.
- Integrates Docker `HEALTHCHECK` probing `GET /health`.
- Binds dynamically to the host's assigned `$PORT`.

To build and run locally with Docker:
```bash
docker build -t eduviber .
docker run -p 2000:2000 --env-file .env eduviber
```

### 3. Production Environment Checklist
Configure these values in your cloud hosting provider's dashboard:

| Variable | Recommended Production Setting | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables HSTS, secure cookies, and reverse proxy trust. |
| `PORT` | Auto-assigned (e.g. `10000` or `8080`) | Cloud provider HTTP port. |
| `MONGODB_URI` | Production Atlas connection string | Dedicated user with `readWrite` on course DB. |
| `SESSION_SECRET` | 64-char random hex string | Cryptographic key for session cookies. |
| `BUNNY_STREAM_LIBRARY_ID`| Numeric library ID | From Bunny.net Stream dashboard. |
| `BUNNY_STREAM_API_KEY` | Bunny Management API key | Server-side key for video existence checks. |
| `BUNNY_STREAM_CDN_HOSTNAME` | `vz-xxxx.b-cdn.net` | Video Delivery CDN hostname. |
| `BUNNY_STREAM_EMBED_TOKEN_KEY`| Token Auth Key | Found under Bunny Library Security settings. |
| `APP_BASE_URL` | `https://courses.yourdomain.com` | Canonical public URL for reset emails. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Production SMTP Provider | Transactional email delivery credentials. |
| `EMAIL_FROM` | `EDUviber <notifications@yourdomain.com>`| Verified domain sender address. |

### 4. Custom Domain, SSL & Reverse Proxy Trust
1. Direct your domain's DNS `CNAME` or `A` record to your cloud host's target URL.
2. Enable automatic SSL/TLS certificate provisioning (Let's Encrypt).
3. The server automatically activates `app.set("trust proxy", 1)` when `NODE_ENV === "production"`, ensuring secure session cookies function seamlessly behind SSL-terminating reverse proxies.

### 5. Bunny Stream Playback Domain Lockdown
To prevent hotlinking and restrict playback strictly to your official application:
1. Navigate to **Bunny.net Dashboard → Stream → Video Libraries → [Your Library] → Security**.
2. Under **Allowed Referrers**, add your production domain(s):
   - `https://courses.yourdomain.com`
   - `courses.yourdomain.com`
3. Confirm **Token Authentication** is toggled **ON** and matches `BUNNY_STREAM_EMBED_TOKEN_KEY`.

### 6. MongoDB Atlas Security & Disaster Recovery
1. **Network Access**: Under Atlas **Network Access**, whitelist your hosting provider's outbound static IPs (or configure AWS VPC Peering).
2. **Automated Backups**:
   - Enable Atlas **Continuous Cloud Backups** for point-in-time recovery down to the second for the last 7 days.
   - Schedule daily automated snapshots with a **30-day retention window**.
3. **Disaster Recovery Sandbox**:
   - Automated sandbox clone and document count verification is validated by Test 7 of `testProductionReadiness.js`. Always test restore procedures against an isolated test database before restoring into production.

---

## 🛠️ Operational Playbooks & Maintenance

### Creating New Administrators
To create additional administrators, run the seeding script with the target credentials:
```bash
ADMIN_NAME="Jane Doe" ADMIN_EMAIL="jane@example.com" ADMIN_PASSWORD="SecurePassword123!" node scripts/createAdmin.js
```

### Reviewing Offline Payments
1. Sign in as an administrator at `/login`.
2. Navigate to `/admin/payments`.
3. Click the filter tabs (`Pending`, `Approved`, `Rejected`) to inspect submissions.
4. Review the student's submitted payment reference and proof document.
5. Click **Approve Payment** to activate student enrollment instantly and trigger an automated confirmation email.
6. If the payment proof is invalid or cannot be verified, click **Reject Payment**, provide a descriptive rejection reason, and the student will be notified and given the option to re-submit proof on their dashboard.

### Emergency User Suspension
If a student's access must be revoked immediately:
1. Navigate to `/admin/enrollments`.
2. Find the student's enrollment record and click **Suspend**.
3. The student's watch access will immediately return `403 Forbidden`, while their watched lesson progress is safely preserved in MongoDB for future reinstatement.

---

## 📄 License & Intellectual Property

Proprietary Software. All rights reserved © 2026 EDUviber.
Unauthorized copying, modification, distribution, or reverse engineering of this software or its video delivery infrastructure is strictly prohibited.
