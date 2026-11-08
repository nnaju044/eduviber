import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    scope: {
      type: String,
      enum: ["course", "module", "lesson"],
      required: true,
      default: "course",
    },
    moduleName: {
      type: String,
      trim: true,
      default: "",
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },
    resourceLinks: [
      {
        title: {
          type: String,
          trim: true,
          default: "",
        },
        url: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast querying by scope and course
assignmentSchema.index({ courseId: 1, isEnabled: 1 });
assignmentSchema.index({ courseId: 1, moduleName: 1 });
assignmentSchema.index({ courseId: 1, lessonId: 1 });

const Assignment = mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);

export default Assignment;
