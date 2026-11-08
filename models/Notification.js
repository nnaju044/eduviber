import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ["assignment_submitted", "assignment_resubmitted", "assignment_reviewed", "general"],
      default: "general",
    },
    data: {
      courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
      submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "AssignmentSubmission" },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      studentName: { type: String, default: "" },
      assignmentTitle: { type: String, default: "" },
      courseTitle: { type: String, default: "" },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
