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
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            index: true,
        },
        lastPositionSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        progressSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        watchedSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        watchedIntervals: {
            type: [[Number]],
            default: [],
        },
        uniqueWatchedSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        progressPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
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
progressSchema.index({ userId: 1, courseId: 1 });

// Auto-synchronize progressSeconds and lastPositionSeconds on document save
progressSchema.pre("save", function () {
    if (this.isModified("lastPositionSeconds") && !this.isModified("progressSeconds")) {
        this.progressSeconds = this.lastPositionSeconds;
    } else if (this.isModified("progressSeconds") && !this.isModified("lastPositionSeconds")) {
        this.lastPositionSeconds = this.progressSeconds;
    } else if (this.lastPositionSeconds !== undefined && this.progressSeconds === undefined) {
        this.progressSeconds = this.lastPositionSeconds;
    } else if (this.progressSeconds !== undefined && this.lastPositionSeconds === undefined) {
        this.lastPositionSeconds = this.progressSeconds;
    }

    if (!this.watchedSeconds && (this.lastPositionSeconds || this.progressSeconds)) {
        this.watchedSeconds = this.lastPositionSeconds || this.progressSeconds || 0;
    }

    if (this.completed && (!this.progressPercentage || this.progressPercentage < 100)) {
        this.progressPercentage = 100;
    }
});

export default mongoose.model("Progress", progressSchema);