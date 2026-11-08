import { Router } from "express";
import authRoutes from "./authRoutes.js";
import publicRoutes from "./publicRoutes.js";
import teacherRoutes from "./teacherRoutes.js";
import studentRoutes from "./studentRoutes.js";
import adminRoutes from "./adminRoutes.js";
import { apiErrorHandler } from "../middleware/apiErrorHandler.js";
import { getCsrfToken } from "../controllers/authController.js";

const apiRouter = Router();

// Top-level CSRF token helper
apiRouter.get("/csrf-token", getCsrfToken);

// Modular API routes
apiRouter.use("/auth", authRoutes);
apiRouter.use("/public", publicRoutes);
apiRouter.use("/teacher", teacherRoutes);
apiRouter.use("/student", studentRoutes);
apiRouter.use("/admin", adminRoutes);

// Catch-all 404 for unrecognized /api/* paths
apiRouter.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint ${req.method} ${req.originalUrl} not found.`,
        code: "ENDPOINT_NOT_FOUND",
    });
});

// Centralized JSON error handling
apiRouter.use(apiErrorHandler);

export default apiRouter;
