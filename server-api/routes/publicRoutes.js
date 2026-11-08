import { Router } from "express";
import {
    listCourses,
    getCourseDetails,
    listTeachers,
    getTeacherProfile,
} from "../controllers/publicController.js";

const router = Router();

// Public course catalog and details
router.get("/courses", listCourses);
router.get("/courses/:slug", getCourseDetails);

// Public teacher directory and profiles
router.get("/teachers", listTeachers);
router.get("/teachers/:id", getTeacherProfile);

export default router;
