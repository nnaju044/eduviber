import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        lessonId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lesson",
            required: true,
            index: true,
        },
        lastPositionSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        watchedSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        completed: {
            type: Boolean,
            default: false,
        },
        lastWatchedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export default mongoose.model("Progress", progressSchema);