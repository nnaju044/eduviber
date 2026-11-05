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
            min: 0,
        },
        durationMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },
        isFreePreview: {
            type: Boolean,
            default: false,
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

// Auto-synchronize durationSeconds and durationMinutes on document save
lessonSchema.pre("save", function () {
    if (this.isModified("durationSeconds") && !this.isModified("durationMinutes")) {
        this.durationMinutes = this.durationSeconds > 0 ? Math.round(this.durationSeconds / 60) : 0;
    } else if (this.isModified("durationMinutes") && !this.isModified("durationSeconds")) {
        this.durationSeconds = this.durationMinutes > 0 ? this.durationMinutes * 60 : 0;
    } else if (this.durationSeconds > 0 && (!this.durationMinutes || this.durationMinutes === 0)) {
        this.durationMinutes = Math.round(this.durationSeconds / 60);
    } else if (this.durationMinutes > 0 && (!this.durationSeconds || this.durationSeconds === 0)) {
        this.durationSeconds = this.durationMinutes * 60;
    }
});

export default mongoose.model("Lesson", lessonSchema);