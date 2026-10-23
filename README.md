# EDUviber — Paid Course Platform

A secure, high-performance web platform for hosting and selling digital video courses with DRM-style protections, dynamic watermarking, and real-time student progress tracking.

---

## 📌 Executive Summary & Current State

The platform is designed to provide content creators and educators with complete control over their digital video assets. Instead of relying on expensive third-party platforms with high transaction fees and leaky player protections, this application provides a self-hosted LMS built on **Express.js**, **MongoDB Atlas**, and **Bunny Stream CDN**.

### Current Implementation Status: **Phase 1 Complete (Core LMS & Video Delivery)**

| Domain | Status | Description |
| :--- | :---: | :--- |
| **Authentication & RBAC** | ✅ Operational | Role-based authentication (Admin / Student), session management with MongoStore, forced password change on first login. |
| **Admin Operations & Content CRUD** | ✅ Operational | Dashboard with metrics, full course & lesson CRUD (editing, slug collision resolution, order conflict handling, reference-checked safe deletion), and publication guards. |
| **Video Protection & CDN** | ✅ Operational | Bunny Stream CDN integration with SHA-256 HMAC-signed embed tokens and API verification. |
| **Student Experience** | ✅ Operational | Student dashboard with progress analytics, module curriculum breakdown, and responsive lesson player. |
| **Anti-Piracy Watermarking** | ✅ Operational | Dynamic floating student email watermark animated over video viewport. |
| **Playback & State Tracking** | ✅ Operational | Player.js API hooks for periodic saving (~10s), pause triggers, pagehide beaconing, and auto-resume. |
| **Payment & Verification** | ✅ Operational | Manual UPI/bank-transfer workflow with server-derived pricing, proof upload, student payment history, and admin review queue (`/admin/payments`) with idempotent enrollment activation. |
| **User Onboarding / Signup** | ⏳ Manual / Seeded | Admin creation via CLI script; public student checkout & self-registration pending. |
| **Public Storefront** | ✅ Operational | Marketing landing page at `/`, published course catalogue at `/courses`, curriculum preview at `/courses/:slug`, and manual enrollment flow. |
| **Student & Enrollment Management** | ✅ Operational | Admin directory (`/admin/students`), student creation with forced password reset, manual course enrollment (`/admin/enrollments`), and status transitions. |
| **Password Recovery & Email** | ✅ Operational | Cryptographic single-use token recovery, generic anti-enumeration responses, 12-char policy, and multi-event transactional email service. |
| **Security & CSRF Protection** | ✅ Operational | Session-based CSRF token validation on all state-changing POST forms across public, student, and admin portals. |
| **Production Readiness & Hardening** | ✅ Operational | Startup environment validation, unauthenticated `/health` probe, login rate limiting, security headers, reverse proxy trust, and stack trace suppression. |

---

## 🏗️ Technical Architecture & Stack

```
                          ┌───────────────────────────┐
                          │   Client Browser          │
                          │   (Tailwind / EJS / JS)   │
                          └─────────────┬─────────────┘
                                        │ HTTP / HTTPS
                                        ▼
                          ┌───────────────────────────┐
                          │   Express 5.3 Application │
                          │   (Node.js ESM)           │
                          └──────┬─────────────┬──────┘
                                 │             │
                    Session & DB │             │ Token Signing & API
                                 ▼             ▼
  ┌────────────────────────────────────┐     ┌───────────────────────────────────┐
  │         MongoDB Atlas              │     │          Bunny.net Stream         │
  │  - Users, Courses, Lessons         │     │  - Transcoded Video Storage       │
  │  - Enrollments, Progress, Payments │     │  - Global CDN Edge Network        │
  │  - Session Store (MongoStore)      │     │  - Token-Protected Player Embed   │
  └────────────────────────────────────┘     └───────────────────────────────────┘
```

- **Runtime**: Node.js (Native ES Modules `"type": "module"`, Node `>=20.0.0`)
- **Backend Framework**: Express.js 5.3.0
- **Database & ODM**: MongoDB Atlas with Mongoose 9.11.2
- **Session Management**: `express-session` with `connect-mongo` 6.0.0 (MongoDB session store)
- **Security & Cryptography**: `bcryptjs` (password hashing with cost factor 12), Node.js `crypto` (SHA-256 HMAC embed token signing), in-memory sliding window rate limiting
- **Video Delivery & CDN**: Bunny Stream (Media Delivery API, Player.js 0.1.0)
- **Frontend / Templating**: EJS (Embedded JavaScript) with Tailwind CSS (via CDN)
- **Process Management**: Docker container / native Node.js for production

---

## 🗄️ Database Schemas & Data Model

The application uses six interconnected Mongoose schemas in `/models`:

### 1. `User` (`models/User.js`)
- **Fields**: `name`, `email` (unique, indexed, lowercase), `phone`, `passwordHash` (hidden with `select: false`), `role` (`"student"` | `"admin"`), `mustChangePassword` (defaults to `true`), `isActive` (boolean).
- **Behavior**: Upon first login, users with `mustChangePassword: true` are trapped in `/change-password` by `requireAuth` middleware until they update their credentials.

### 2. `Course` (`models/Course.js`)
- **Fields**: `title`, `slug` (unique, indexed, auto-generated from title), `description`, `price` (INR, min 0), `thumbnail` (image URL), `instructor`, `isPublished` (boolean, default `false`).
- **Behavior**: Unpublished courses are invisible to students. Admins can toggle publication status.

### 3. `Lesson` (`models/Lesson.js`)
- **Fields**: `courseId` (ref `Course`), `title`, `description`, `moduleName` (e.g., "Module 1", "Day 1"), `order` (number, min 1), `durationSeconds`, `bunnyVideoId` (UUID string), `isPublished` (boolean, default `false`).
- **Indexes**: Compound unique index `{ courseId: 1, order: 1 }` prevents order collisions within a course.
- **Publication Guard**: A lesson cannot be published unless its parent course is published and a valid `bunnyVideoId` is attached.

### 4. `Enrollment` (`models/Enrollment.js`)
- **Fields**: `userId` (ref `User`), `courseId` (ref `Course`), `status` (`"pending"` | `"active"` | `"suspended"` | `"expired"`), `approvedAt` (Date).
- **Indexes**: Compound unique index `{ userId: 1, courseId: 1 }`.
- **Behavior**: Controls student access to `/courses/:courseId/lessons/:lessonId/watch`. Admin accounts bypass enrollment checks.

### 5. `Progress` (`models/Progress.js`)
- **Fields**: `userId` (ref `User`), `lessonId` (ref `Lesson`), `lastPositionSeconds` (number), `watchedSeconds` (number), `completed` (boolean), `lastWatchedAt` (Date).
- **Indexes**: Compound unique index `{ userId: 1, lessonId: 1 }`.
- **Behavior**: Upserted via `/courses/:courseId/lessons/:lessonId/progress` whenever students pause, watch periodically, or reach video end.

### 6. `Payment` (`models/Payment.js`)
- **Fields**: `userId` (ref `User`), `courseId` (ref `Course`), `amount`, `transactionReference`, `proofUrl`, `status` (`"pending"` | `"approved"` | `"rejected"`), `reviewedAt`, `rejectionReason`.
- **Behavior**: Ready for manual transaction verification (e.g. UPI screenshot upload) or automated gateway webhooks.

---

## 🔐 Anti-Piracy & Content Protection

Content protection is a primary design pillar of this product:

1. **Bunny Stream Token Authentication**:
   - Embed URLs are not static. Each playback session generates a short-lived signed URL using SHA-256 HMAC:
     $$\text{Token} = \text{SHA256}(\text{BUNNY\_STREAM\_EMBED\_TOKEN\_KEY} + \text{videoId} + \text{expires})$$
   - Default TTL is **3,600 seconds (1 hour)**. Expired URLs cannot be reused or shared.
2. **API Verification Before Stream Render**:
   - Before serving the watch page, the server calls Bunny's Video Management API (`https://video.bunnycdn.com/library/.../videos/...`) with an abort signal timeout to confirm the video is encoded, exists, and belongs to the owner's library.
3. **Dynamic Anti-Screen Recording Watermark**:
   - The watch page injects a moving watermark showing the authenticated student's email directly over the video frame.
   - An infinite 24-second CSS keyframe animation relocates the watermark between screen corners, discouraging screen-capture piracy and providing attribution evidence if leaked.
   - *Technical Note on Browser Overlays*: While moving CSS overlays provide high friction against casual screen recording and deter redistribution through visible attribution, browser overlays cannot prevent hardware-level capture (e.g., HDMI splitters) or client DOM suppression via DevTools. Hardware DRM (Widevine / FairPlay) requires dedicated encrypted streaming pipelines.
4. **Cache & Session Hardening**:
   - Video watch routes send `Cache-Control: no-store, private` to prevent intermediate proxy and browser disk caching.
   - Session cookies utilize `httpOnly: true`, `sameSite: "lax"`, and `secure: true` in production.
   - Sessions are regenerated upon login to prevent session fixation attacks.

---

## 💻 Application Routes & Controller Logic

### 1. Public Storefront & Discovery (`routes/publicRoutes.js`)
- `GET /`: Landing page with hero banner, value proposition, trust metrics, and published courses showcase.
- `GET /health`: Unauthenticated liveness probe returning `{ status: "ok", uptime, database: "connected" }` with zero secret exposure.
- `GET /courses`: Complete course catalogue showing all published programs with lesson counts, durations, and INR pricing.
- `GET /courses/:slug`: Public syllabus preview grouped by modules, displaying only published lessons without leaking video stream tokens.
- `GET /courses/:slug/enroll`: Account verification and manual payment instruction screen.
- `POST /courses/:slug/enroll`: Records pending transaction references (`Payment`) for administrator verification.
- `GET /payments/:id/proof`: Secure access to uploaded payment proof, restricted to the payment owner or an admin.

### 2. Authentication & Password Recovery (`routes/authRoutes.js`)
- `GET /login`: Renders login view with support for post-reset success confirmation alerts. Redirects authenticated users to `/admin` or `/dashboard`.
- `POST /login`: Rate-limited (10 attempts / 15m). Validates email and bcrypt password. Regenerates session. Redirects to `/change-password` if flagged.
- `POST /logout`: Destroys session, clears `course.sid` cookie, and redirects to `/login`.
- `GET /forgot-password`: Password recovery request form.
- `POST /forgot-password`: Rate-limited (5 attempts / 15m). Generates a 32-byte cryptographic token, stores SHA-256 hash with 1-hour expiry, dispatches reset email, and returns a generic confirmation to prevent user enumeration.
- `GET /reset-password`: Validates token against database hash and expiry, rendering the password reset form or friendly expiration guidance.
- `POST /reset-password`: Validates $\ge 12$ character passwords, updates bcrypt hash, clears single-use reset token, clears `mustChangePassword`, invalidates stale sessions, and redirects to `/login?reset=success`.
- `GET /change-password`: Enforced onboarding screen for mandatory password resets.
- `POST /change-password`: Validates $\ge 12$ character passwords, hashes with bcrypt, updates user, and clears flag.

### 3. Student Experience (`routes/studentRoutes.js`)
- `GET /dashboard`:
  - Aggregates active enrolled courses.
  - Computes per-course lesson completion counts, progress percentages, and identifies the `nextLesson` to resume.
  - Groups lessons by `moduleName` for the curriculum dropdown.
  - Calculates overall global completion rate across all enrolled courses.
  - Displays personal payment history with status badges, rejection notices, and retry payment triggers.
- `GET /courses/:courseId/lessons/:lessonId/watch`:
  - Verifies user enrollment (or admin status) and publication status of both course and lesson.
  - Validates video via Bunny API and generates signed embed token.
  - Delivers lesson player with student watermark, last saved timestamp, and completion status.
- `POST /courses/:courseId/lessons/:lessonId/progress`:
  - Endpoint for Player.js beacon and Ajax syncs protected by CSRF token validation.
  - Validates position bounds against lesson duration.
  - Upserts `Progress` collection with `lastPositionSeconds`, `completed` flag, and `lastWatchedAt`.

### 4. Administrator Portal (`routes/adminRoutes.js` under `/admin`)
- `GET /admin`: Dashboard summarizing operational metrics and recent courses.
- `GET /admin/courses`: List all courses with total lesson counts and publish states.
- `GET /admin/courses/new` & `POST /admin/courses`: Course creation with slug generation and collision avoidance.
- `GET /admin/courses/:id/edit` & `POST /admin/courses/:id`: Edit course metadata, price, thumbnail, instructor, and slug with uniqueness check.
- `POST /admin/courses/:id/delete`: Safe course deletion requiring explicit confirmation. Strictly blocks deletion if payment or enrollment records exist.
- `POST /admin/courses/:id/toggle-publication`: Toggles course publication state.
- `GET /admin/courses/:courseId/lessons`: Module-wise lesson listing for a specific course.
- `GET /admin/courses/:courseId/lessons/new` & `POST /admin/courses/:courseId/lessons`: Creates a lesson, automatically suggesting the next sequential order number.
- `GET /admin/courses/:courseId/lessons/:lessonId/edit` & `POST /admin/courses/:courseId/lessons/:lessonId`: Edit lesson details, module grouping, order conflict resolution, duration, Bunny video GUID, and publication guard checks.
- `POST /admin/courses/:courseId/lessons/:lessonId/delete`: Safe lesson deletion requiring explicit confirmation, verifying progress history.
- `POST /admin/courses/:courseId/lessons/:lessonId/toggle-publication`: Toggles lesson state with safety checks.
- `GET /admin/students`: Searchable student directory with pagination and enrollment counts.
- `GET /admin/students/new` & `POST /admin/students`: Provision new student account with forced password reset on first login.
- `GET /admin/students/:id`: Detailed student profile with enrollment history and quick-enroll course action.
- `GET /admin/enrollments`: Course permissions dashboard filtered by status (`pending`, `active`, `suspended`, `expired`).
- `POST /admin/enrollments`: Manually assign a published course to a student.
- `POST /admin/enrollments/:id/status`: Transition enrollment status (e.g. activate, suspend) without deleting progress.
- `GET /admin/payments`: Payment audit queue with filter tabs (`pending`, `approved`, `rejected`, `all`), student info, course price, and proof review.
- `POST /admin/payments/:id/approve`: Approves payment and idempotently creates or activates the student's `Enrollment`.
- `POST /admin/payments/:id/reject`: Rejects payment with mandatory `rejectionReason`, retaining complete audit history.

---

## 📂 Directory Layout

```
Digital_Product_Blueprint/
├── config/
│   ├── bunny.js              # Bunny Stream API verification & HMAC token generator
│   ├── db.js                 # Mongoose Atlas connection with timeout handling
│   └── env.js                # Startup environment variable validation
├── controllers/
│   ├── adminController.js    # Admin analytics, course & lesson CRUD logic
│   ├── authController.js     # Login, logout, and password change flows
│   ├── publicController.js   # Landing, catalogue, course syllabus, and manual enrollment
│   └── studentController.js  # Dashboard aggregation, watch verification, progress sync
├── middleware/
│   ├── csrf.js               # CSRF protection middleware with session tokens & test header bypass
│   ├── rateLimiter.js        # Sliding-window in-memory brute-force rate limiter
│   └── requireAuth.js        # Authentication & Role-based Access Control (RBAC)
├── models/
│   ├── Course.js             # Course schema
│   ├── Enrollment.js         # Student course enrollment & status schema
│   ├── Lesson.js             # Lesson schema with module grouping & ordering
│   ├── Payment.js            # Payment transaction tracking schema
│   ├── Progress.js           # Per-student video progress schema
│   └── User.js               # User accounts schema with bcrypt support
├── public/
│   ├── css/                  # Custom CSS (reserved for custom asset builds)
│   ├── images/               # Local static images
│   └── js/                   # Client-side scripts
├── routes/
│   ├── adminRoutes.js        # Protected /admin route group
│   ├── authRoutes.js         # Authentication route group
│   ├── publicRoutes.js       # Storefront & course catalogue route group
│   └── studentRoutes.js      # Student dashboard & watch route group
├── scripts/
│   ├── createAdmin.js        # CLI utility to seed initial administrator
│   ├── testAdminStudentEnrollment.js # Automated test suite for student & enrollment operations
│   ├── testCourseLessonManagement.js # Automated test suite for course & lesson CRUD, slug collisions & reference integrity
│   ├── testEndToEndLifecycle.js # Complete 10-step end-to-end lifecycle & boundary integration tests
│   ├── testPasswordRecoveryAndEmail.js # Automated test suite for recovery tokens & email delivery
│   ├── testPaymentWorkflow.js# Automated test suite for manual payment verification
│   ├── testProductionReadiness.js # Automated test suite for health probe, security headers & rate limiting
│   └── testStorefront.js     # Automated test suite for storefront & security checks
├── services/
│   └── emailService.js       # Transactional email service & branded responsive templates
├── views/
│   ├── admin/
│   │   ├── courses/
│   │   │   ├── edit.ejs      # Course edit form with danger zone & deletion safety
│   │   │   ├── index.ejs     # Course list table & publish buttons
│   │   │   └── new.ejs       # Course creation form
│   │   ├── dashboard.ejs     # Admin stats overview
│   │   ├── enrollments/
│   │   │   └── index.ejs     # Manual enrollment assignment & status management
│   │   ├── lessons/
│   │   │   ├── edit.ejs      # Lesson edit form with danger zone & publication guard
│   │   │   ├── index.ejs     # Lesson table per course
│   │   │   └── new.ejs       # Lesson creation form
│   │   ├── payments/
│   │   │   └── index.ejs     # Manual payment audit queue with filters & review modals
│   │   └── students/
│   │       ├── index.ejs     # Searchable student directory table
│   │       ├── new.ejs       # Student account creation form
│   │       └── show.ejs      # Student detail profile with enrollment history
│   ├── auth/
│   │   ├── change-password.ejs # Mandatory password reset view
│   │   ├── forgot-password.ejs # Account recovery request form
│   │   ├── login.ejs         # User sign-in view
│   │   └── reset-password.ejs  # Secure token password update view
│   ├── partials/             # Reusable view components
│   ├── public/
│   │   ├── 404.ejs           # Public not found error page
│   │   ├── catalog.ejs       # Published course catalogue grid
│   │   ├── course-detail.ejs # Public syllabus preview & enrollment CTA
│   │   ├── enroll-login-required.ejs # Guidance for anonymous checkout
│   │   ├── enroll-success.ejs# Payment reference confirmation
│   │   ├── enroll.ejs        # Manual bank/UPI payment instructions & form
│   │   └── landing.ejs       # Storefront marketing landing page
│   └── student/
│       ├── dashboard.ejs     # Student dashboard with analytics & outline
│       └── lesson.ejs        # Video player with watermark & Player.js sync
├── .dockerignore             # Excluded files for container builds
├── .env                      # Local environment secrets (NEVER commit!)
├── .env.example              # Sanitized template for environment configuration
├── .gitignore                # Git ignore rules
├── Dockerfile                # Production multi-stage Node.js container definition
├── LAUNCH_READINESS_REPORT.md # Pre-launch audit evidence, test results & GO verdict
├── package.json              # Project dependencies & scripts
├── server.js                 # Application bootstrap & middleware pipeline
└── README.md                 # Product documentation (this file)
```

---

## ⚙️ Environment Variables

Configure these keys inside `.env` in the project root:

```env
# Server
PORT=2000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
SESSION_SECRET=your_super_secret_session_key_at_least_32_chars

# Admin Seeding (Used by scripts/createAdmin.js)
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=YourSecurePassword123!

# Manual Payment Instructions (Configurable offline UPI & Bank Transfer)
PAYMENT_UPI_ID=merchant@upi
PAYMENT_ACCOUNT_NAME="EDUviber LLC"
PAYMENT_BANK_NAME="HDFC Bank"
PAYMENT_ACCOUNT_NO="50200012345678"
PAYMENT_IFSC=HDFC0001234
PAYMENT_NOTE="Please transfer the exact amount and save your UTR / transaction reference number."

# Transactional Email Configuration (Resend, SendGrid, Postmark, AWS SES, or custom SMTP)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=your_transactional_email_api_key_or_password
EMAIL_FROM="EDUviber <notifications@yourdomain.com>"
APP_BASE_URL=http://localhost:2000

# Bunny Stream Integration
BUNNY_STREAM_LIBRARY_ID=123456
BUNNY_STREAM_API_KEY=your_bunny_stream_api_key
BUNNY_STREAM_CDN_HOSTNAME=vz-xxxx.b-cdn.net
BUNNY_STREAM_EMBED_TOKEN_KEY=your_embed_token_authentication_key
```

> [!IMPORTANT]
> To obtain your `BUNNY_STREAM_EMBED_TOKEN_KEY`, navigate to **Bunny.net Dashboard → Stream → Video Libraries → [Your Library] → Security → Enable Token Authentication**, then copy the token authentication key.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed the Initial Administrator Account
Before starting the server, seed your primary administrator user into MongoDB:
```bash
node scripts/createAdmin.js
```
*Make sure `ADMIN_EMAIL` and `ADMIN_PASSWORD` (min 12 characters) are set in `.env`.*

### 3. Run Automated Regression Test Suites
```bash
npm test
```
*Executes all seven core test suites: storefront discovery, admin student/enrollment management, manual payment verification, password recovery & transactional email, course & lesson CRUD / data integrity, production readiness & security, and complete end-to-end lifecycle verification.*

### 4. Start the Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:2000` (or the configured `PORT`).

### 5. Admin Access
1. Visit `http://localhost:2000/login`
2. Enter your seeded admin email and password.
3. You will be redirected to `http://localhost:2000/admin`.
4. Review student payments under `/admin/payments`, assign courses, and publish lessons.

---

## 🚢 Production Deployment Guide

### 1. Hosting Architecture Requirements
This application is a **server-rendered, stateful Express 5 web application** using EJS templating, persistent MongoStore sessions, signed token HMAC generation, and `keepalive` video progress beaconing.
- **Recommended Hosts**: **Render** (Web Service), **Railway**, **Fly.io**, **DigitalOcean App Platform**, or **AWS App Runner / ECS**.
- **Static Hosting Incompatibility**: Do **not** deploy to static-only hosting (e.g. standard Netlify/GitHub Pages) or pure serverless frontends without long-running session support, as background video beaconing and stateful session cookies require persistent Express server processes.

### 2. Containerized Deployment (Recommended)
The repository includes a production multi-stage [`Dockerfile`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/Digital_Product_Blueprint/Dockerfile) based on `node:20-alpine`:
- Executes as least-privileged user `node`.
- Includes integrated Docker `HEALTHCHECK` probing `GET /health`.
- Binds dynamically to the host's assigned `$PORT`.

To build and run locally with Docker:
```bash
docker build -t digital-product-blueprint .
docker run -p 2000:2000 --env-file .env digital-product-blueprint
```

### 3. Production Environment Variables Checklist
Configure these environment variables in your hosting provider's dashboard:

| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | Set to `production` (enforces HSTS, secure cookies, and proxy trust). |
| `PORT` | HTTP port | Automatically assigned by host (e.g., Render, Railway). Defaults to `2000`. |
| `MONGODB_URI` | Atlas connection string | Dedicated production user with least-privilege `readWrite` on course DB. |
| `SESSION_SECRET` | Cryptographic session key | Cryptographically random string ($\ge 32$ characters). |
| `BUNNY_STREAM_LIBRARY_ID` | Video library identifier | Numeric library ID from Bunny dashboard. |
| `BUNNY_STREAM_API_KEY` | Video Management API key | Server-side API key for video existence verification. |
| `BUNNY_STREAM_CDN_HOSTNAME` | Delivery CDN hostname | E.g. `vz-xxxx.b-cdn.net`. |
| `BUNNY_STREAM_EMBED_TOKEN_KEY` | SHA-256 HMAC signing key | Token Authentication key from Bunny Stream security settings. |
| `APP_BASE_URL` | Canonical public URL | E.g. `https://courses.yourdomain.com` (used for password reset links). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Transactional email | E.g. Resend, SendGrid, Amazon SES credentials. |

### 4. Custom Domain, SSL & Reverse Proxy Trust
1. Point your domain's DNS `CNAME` or `A` record to your cloud host's target URL.
2. Enable automatic SSL/TLS certificate provisioning (Let's Encrypt).
3. The server automatically enables `app.set("trust proxy", 1)` when `NODE_ENV === "production"`, ensuring secure session cookies function behind SSL-terminating proxies.

### 5. Bunny Stream Playback Domain Restrictions
To prevent hotlinking and restrict playback strictly to your official application:
1. Navigate to **Bunny.net Dashboard → Stream → Video Libraries → [Your Library] → Security**.
2. Under **Allowed Referrers**, add your production domain(s):
   - `https://courses.yourdomain.com`
   - `courses.yourdomain.com`
3. Ensure **Token Authentication** is toggled **ON** and matches `BUNNY_STREAM_EMBED_TOKEN_KEY`.

### 6. MongoDB Atlas Security & Network Isolation
1. **Database Access**: Create a dedicated database user with `readWrite` privileges restricted only to the specific application database. Never use Atlas cluster administrator credentials.
2. **Network Access**: Under Atlas **Network Access**, restrict IP access to your host's static outbound egress IPs (if available) or configure AWS VPC Peering.
3. **Backup Schedule & Retention**:
   - Enable Atlas **Continuous Cloud Backups**.
   - Schedule daily automated snapshots with a 30-day retention window.
   - For point-in-time recovery, Atlas Continuous Backup allows restoration down to the second within the last 7 days.
4. **Restore Verification**: Always test database restores into an isolated sandbox database (e.g., `_restore_sandbox_test`) before touching production records.

### 7. Zero Sensitive Logging & Rollback Procedures
- **Log Hygiene**: The application's centralized error handler and middleware log only sanitized messages. Passwords, session secrets, payment proofs, and reset tokens are strictly excluded from console logs.
- **Zero-Downtime Rollback**:
  - In Render / Railway / Fly.io: Navigate to **Deployments → Select previous successful build → Click Rollback**.
  - In Docker: Re-deploy the previously tagged stable container image (`docker run <image-tag>`).

---

## 📋 Outstanding Gaps & Next Steps (Product Roadmap)

The following areas represent the next development priorities to complete the commercial launch:

### 1. Public Sales & Landing Experience (Status: ✅ Completed)
- **Implemented**: Responsive marketing landing page at `/`, published course catalogue at `/courses`, curriculum preview at `/courses/:slug`, and manual offline enrollment workflow at `/courses/:slug/enroll`.

### 2. Student Self-Serve Checkout & Manual Payments (Status: ✅ Completed)
- **Implemented**: 
  - Dynamic student checkout screen with server-derived course price and configurable UPI/Bank transfer details.
  - Transaction reference submission with safe payment screenshot (base64) or trusted cloud drive proof (Google Drive/Dropbox/OneDrive).
  - Student payment history on dashboard with status indicators, admin rejection feedback, and retry purchase capability.
  - Admin audit queue (`/admin/payments`) with status filtering (`pending`, `approved`, `rejected`), modal review dialogues, and idempotent enrollment activation via MongoDB transaction / conditional update.
- **Future Enhancement**: Optional payment gateway webhooks (Razorpay / Stripe) for instant automated enrollment activation.

### 3. Admin Enrollment & Student Management UI (Status: ✅ Completed)
- **Implemented**: Protected `/admin/students` directory with search and pagination, student creation with forced password reset, student profile view with enrollment history, and `/admin/enrollments` manual course assignment with full status lifecycle management.

### 4. Password Recovery & Transactional Email Notifications (Status: ✅ Completed)
- **Implemented**:
  - Secure `/forgot-password` flow with generic confirmation avoiding user enumeration.
  - Cryptographically secure 32-byte tokens with SHA-256 hash storage and 1-hour expiration.
  - Single-use token invalidation, $\ge 12$ character password enforcement, bcrypt hashing, and session renewal.
  - Provider-agnostic transactional email service (SMTP / Resend / SendGrid / Postmark) with responsive HTML and plain-text templates.
  - Multi-event triggers: Password Reset, Welcome/Account Setup, Payment Submission, Payment Approval, Payment Rejection, and Enrollment Activation.
  - Zero plaintext passwords emailed; dry-run/test safety guard preventing unwanted real email dispatches.

### 5. Course & Lesson Editing / Deletion (Status: ✅ Completed)
- **Implemented**:
  - Course edit form and controller (`GET /admin/courses/:id/edit`, `POST /admin/courses/:id`) supporting title, description, price, thumbnail, instructor, slug editing with collision avoidance, and publication toggle.
  - Lesson edit form and controller (`GET /admin/courses/:courseId/lessons/:lessonId/edit`, `POST /admin/courses/:courseId/lessons/:lessonId`) with module name, order conflict detection within course, duration, Bunny video GUID, and publication guard.
  - Safe deletion safeguards: Course hard deletion is strictly blocked if `Payment` or `Enrollment` records exist. Explicit confirmation (`DELETE` or title match) is required. Lesson deletion verifies `Progress` records and requires confirmation.
  - CSRF protection: Session-based CSRF middleware protecting all state-changing forms across the application.

### 6. Production Readiness & Security Hardening (Status: ✅ Completed)
- **Implemented**:
  - Startup environment secret validation ([`config/env.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/Digital_Product_Blueprint/config/env.js)).
  - Load balancer health check probe at `GET /health`.
  - Rate limiting on `/login` and `/forgot-password` to prevent credential brute-forcing ([`middleware/rateLimiter.js`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/Digital_Product_Blueprint/middleware/rateLimiter.js)).
  - Defensive security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, HSTS in production, `x-powered-by` disabled).
  - Reverse proxy trust (`app.set("trust proxy", 1)`).
  - Centralized Express 5 error handler suppressing stack traces and internal schema leaks.
  - Production multi-stage [`Dockerfile`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/Digital_Product_Blueprint/Dockerfile) and sanitized [`.env.example`](file:///Users/jeebs/Library/Mobile%20Documents/com~apple~CloudDocs/Digital_Product_Blueprint/.env.example).

### 7. Video Upload Direct from Admin Panel (Priority: Low / Enhancement)
- **Current**: Admin enters existing Bunny Stream video GUIDs manually into the lesson form.
- **Needed**: Direct chunked/TUS file upload to Bunny Stream API from the admin lesson form with live progress bar.

---

## 📄 License

Proprietary — All rights reserved.
