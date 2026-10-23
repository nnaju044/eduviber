import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { validateEnvironment } from "./config/env.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { csrfProtection } from "./middleware/csrf.js";

dotenv.config();

// Validate critical secrets and configuration on boot
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 2000;

// Trust front-facing reverse proxy (e.g. Vercel, Render, AWS ALB, Nginx, Fly.io, Cloudflare)
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    app.set("trust proxy", 1);
}

// Disable technology disclosure header
app.disable("x-powered-by");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Defensive HTTP security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});

// Explicit request body size limits to prevent memory-exhaustion attacks
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Health-check endpoint for load balancers, Vercel, and container orchestrators (no secrets exposed)
app.get("/health", async (req, res) => {
    try {
        await connectDB();
    } catch {
        // Logging handled inside connectDB
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const status = isDbConnected ? "ok" : "degraded";
    const statusCode = isDbConnected ? 200 : 503;

    return res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: isDbConnected ? "connected" : "disconnected",
    });
});

// Ensure MongoDB connection is established for all application routes
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        next(err);
    }
});

app.use(
  session({
    name: "course.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(csrfProtection);

app.use(publicRoutes);
app.use(authRoutes);
app.use(studentRoutes);
app.use("/admin", adminRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).render("public/404", {
    message: "Page Not Found",
    user: req.session?.user || null,
  });
});

// Centralized error handler - masks internal errors and prevents stack trace leakage
app.use((err, req, res, next) => {
  console.error("[App Error]", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const isApi = req.xhr || req.headers.accept?.includes("application/json");
  if (isApi) {
    return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }

  res.status(500).render("public/404", {
    message: "An unexpected error occurred. Please try again later.",
    user: req.session?.user || null,
  });
});

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

// Only start standalone HTTP listener when executed directly (not when imported in tests or serverless)
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution && !process.env.VERCEL) {
  startServer();
}

export default app;