import mongoose from "mongoose";

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    driveLinks: [
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
    textAnswer: {
      type: String,
      trim: true,
      default: "",
      maxlength: 15000,
    },
    status: {
      type: String,
      enum: ["submitted", "reviewed"],
      default: "submitted",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring every student's submission version for an assignment is unique and historical
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1, version: 1 }, { unique: true });
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1, createdAt: -1 });

const AssignmentSubmission =
  mongoose.models.AssignmentSubmission || mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);

export default AssignmentSubmission;
