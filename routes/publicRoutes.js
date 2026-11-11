import { Router } from "express";
import { servePaymentProof } from "../controllers/publicController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Compatibility redirects from legacy top-level routes to canonical React SPA routes
router.get("/", (req, res) => res.redirect(302, "/app"));
router.get("/courses", (req, res) => res.redirect(302, "/app/courses"));
router.get("/courses/:slug", (req, res) => res.redirect(302, `/app/courses/${encodeURIComponent(req.params.slug)}`));
router.get("/courses/:slug/enroll", (req, res) => res.redirect(302, `/app/courses/${encodeURIComponent(req.params.slug)}`));

// Binary payment proof serving (Express endpoint, returns image/jpeg buffer or redirect)
router.get("/payments/:id/proof", requireAuth, servePaymentProof);

export default router;
