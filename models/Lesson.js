import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        moduleName: {
            type: String,
            default: "Module 1",
        },
        order: {
            type: Number,
            required: true,
            min: 1,
        },
        durationSeconds: {
            type: Number,
            default: 0,
        },
        bunnyVideoId: {
            type: String,
            default: "",
            trim: true,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

lessonSchema.index({ courseId: 1, order: 1 }, { unique: true });

export default mongoose.model("Lesson", lessonSchema);