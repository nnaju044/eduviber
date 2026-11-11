import Notification from "../models/Notification.js";

/**
 * Creates an in-app notification if an identical unread notification was not created recently.
 */
export async function createNotification({ userId, title, message, type, data = {} }) {
  if (!userId) return null;

  try {
    // Prevent duplicate unread notifications created within a 1-minute window
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existing = await Notification.findOne({
      userId,
      type,
      "data.assignmentId": data.assignmentId || null,
      "data.studentId": data.studentId || null,
      isRead: false,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (existing) {
      return existing;
    }

    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      data,
    });
    return notification;
  } catch (err) {
    console.error("[NotificationService] Error creating notification:", err.message);
    return null;
  }
}

/**
 * Notify teacher on student assignment submission
 */
export async function notifyTeacherOnSubmission({ teacherId, student, assignment, course, isResubmission = false }) {
  const eventLabel = isResubmission ? "resubmitted" : "submitted";
  const title = isResubmission ? "Assignment Resubmitted" : "New Assignment Submission";
  const message = `${student.name} ${eventLabel} homework for "${assignment.title}" in course "${course.title}".`;

  return createNotification({
    userId: teacherId,
    title,
    message,
    type: isResubmission ? "assignment_resubmitted" : "assignment_submitted",
    data: {
      courseId: course._id,
      assignmentId: assignment._id,
      studentId: student._id,
      studentName: student.name,
      assignmentTitle: assignment.title,
      courseTitle: course.title,
    },
  });
}

/**
 * Notify student on teacher review
 */
export async function notifyStudentOnReviewed({ studentId, assignment, course }) {
  const title = "Assignment Reviewed";
  const message = `Your submission for "${assignment.title}" in course "${course.title}" has been reviewed by your instructor.`;

  return createNotification({
    userId: studentId,
    title,
    message,
    type: "assignment_reviewed",
    data: {
      courseId: course._id,
      assignmentId: assignment._id,
      assignmentTitle: assignment.title,
      courseTitle: course.title,
    },
  });
}

/**
 * Notify enrolled students when a new assignment is created and enabled
 */
export async function notifyStudentsOnAssignmentEnabled({ courseId, assignment, courseTitle }) {
  try {
    const Enrollment = (await import("../models/Enrollment.js")).default;
    const enrollments = await Enrollment.find({ courseId, status: "active" }).select("userId").lean();
    if (!enrollments || enrollments.length === 0) return;

    const title = "New Assignment Available";
    const scopeLabel = assignment.scope === "course" ? "Course" : assignment.scope === "module" ? `Module "${assignment.moduleName}"` : "Lesson";
    const message = `A new ${scopeLabel} assignment "${assignment.title}" is now available in "${courseTitle}".`;

    for (const enrollment of enrollments) {
      await createNotification({
        userId: enrollment.userId,
        title,
        message,
        type: "assignment_created",
        data: {
          courseId,
          assignmentId: assignment._id,
          assignmentTitle: assignment.title,
          courseTitle,
        },
      });
    }
  } catch (err) {
    console.error("[NotificationService] Error notifying students on assignment enabled:", err.message);
  }
}
