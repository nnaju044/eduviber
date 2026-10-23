import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["pending", "active", "suspended", "expired"],
            default: "pending",
        },
        approvedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model("Enrollment", enrollmentSchema);