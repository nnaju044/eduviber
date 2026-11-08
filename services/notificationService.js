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
