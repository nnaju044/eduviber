import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth.js";

const router = Router();

// Every route requires an authenticated admin.
router.use(requireAuth, requireAdmin);

// Compatibility redirects from legacy /admin EJS paths to canonical React SPA routes
router.get("/", (req, res) => res.redirect(302, "/app/admin"));
router.get(["/courses", "/courses/*path"], (req, res) => res.redirect(302, "/app/admin/courses"));
router.get(["/students", "/students/*path"], (req, res) => res.redirect(302, "/app/admin/students"));
router.get(["/enrollments", "/enrollments/*path"], (req, res) => res.redirect(302, "/app/admin/payments"));
router.get(["/payments", "/payments/*path"], (req, res) => res.redirect(302, "/app/admin/payments"));

export default router;
