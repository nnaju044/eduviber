import { Router } from "express";
import {
    showLandingPage,
    listPublicCourses,
    showCourseDetail,
    showEnrollmentPage,
    submitEnrollmentPayment,
    servePaymentProof,
} from "../controllers/publicController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", showLandingPage);
router.get("/courses", listPublicCourses);
router.get("/courses/:slug", showCourseDetail);
router.get("/courses/:slug/enroll", showEnrollmentPage);
router.post("/courses/:slug/enroll", submitEnrollmentPayment);
router.get("/payments/:id/proof", requireAuth, servePaymentProof);

export default router;
