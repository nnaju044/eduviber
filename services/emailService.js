import nodemailer from "nodemailer";

// In-memory capture for tests and local dry-runs
const sentEmailsHistory = [];

/**
 * Returns recorded emails (primarily for automated testing)
 */
export function getSentEmails() {
    return [...sentEmailsHistory];
}

/**
 * Clears the test email history
 */
export function clearSentEmails() {
    sentEmailsHistory.length = 0;
}

/**
 * Creates the appropriate Nodemailer transporter based on environment configuration.
 * In test mode or when SMTP is unconfigured, uses JSON transport to capture sent emails safely.
 */
function createTransporter() {
    const isTest = process.env.NODE_ENV === "test";
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

    if (isTest || !hasSmtp) {
        return nodemailer.createTransport({
            jsonTransport: true,
        });
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Sends a transactional email with both HTML and plain-text fallbacks.
 * Never throws fatal errors to caller; always returns status object.
 */
export async function sendTransactionalEmail({ to, subject, html, text }) {
    if (!to) {
        console.warn("[EmailService] No recipient specified, skipping send.");
        return { success: false, error: "No recipient specified." };
    }

    const from =
        process.env.EMAIL_FROM ||
        '"EDUviber" <notifications@eduviber.com>';

    try {
        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text,
        });

        const record = {
            messageId: info.messageId,
            to,
            subject,
            html,
            text,
            envelope: info.envelope,
            timestamp: new Date(),
        };

        sentEmailsHistory.push(record);

        if (process.env.NODE_ENV !== "test" && !process.env.SMTP_HOST) {
            console.log(
                `[EmailService: Dry Run] Email to ${to} | Subject: "${subject}"`
            );
        }

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Common HTML wrapper layout for responsive, accessible transactional emails.
 */
function wrapEmailHtml({ title, bodyContent }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background: #111827; padding: 24px 32px; text-align: left; }
    .brand { font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .brand span { color: #d97706; }
    .body { padding: 32px; font-size: 15px; line-height: 1.6; color: #374151; }
    .btn { display: inline-block; background-color: #111827; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .footer { padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; font-size: 12px; color: #6b7280; text-align: center; }
    .notice { font-size: 13px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">EDUviber<span>.</span></div>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      This is an automated notification from EDUviber. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Password Reset Email
 */
export async function sendPasswordResetEmail({ user, resetToken, baseUrl }) {
    const rootUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:2000";
    const resetUrl = `${rootUrl}/reset-password?token=${resetToken}`;
    const subject = "Reset your password — EDUviber";

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #111827;">Password Reset Request</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>We received a request to reset the password for your account associated with <strong>${user.email}</strong>.</p>
      <p>Click the button below to choose a new password. This link is single-use and will expire in <strong>1 hour</strong>.</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #d97706; word-break: break-all;">${resetUrl}</a></p>
      <div class="notice">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>
    `;

    const text = `Hello ${user.name || "there"},\n\nWe received a request to reset your password. Use the link below to set a new password:\n\n${resetUrl}\n\nThis link is single-use and valid for 1 hour.\n\nIf you did not request this, please ignore this email.`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}

/**
 * 2. Welcome / Initial Password Setup Email
 */
export async function sendWelcomeSetupEmail({ user, resetToken, baseUrl }) {
    const rootUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:2000";
    const setupUrl = `${rootUrl}/reset-password?token=${resetToken}`;
    const subject = "Welcome to EDUviber — Set up your password";

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #111827;">Welcome to EDUviber!</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>An account has been created for you at EDUviber. To access your courses, please set up your account password below:</p>
      <p style="text-align: center;">
        <a href="${setupUrl}" class="btn">Set Up Your Password</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Or open this link directly:<br>
      <a href="${setupUrl}" style="color: #d97706; word-break: break-all;">${setupUrl}</a></p>
      <div class="notice">
        Passwords must be at least 12 characters long.
      </div>
    `;

    const text = `Welcome to EDUviber, ${user.name || "there"}!\n\nAn account has been created for you. Set up your password using the following link:\n\n${setupUrl}\n\nPassword must be at least 12 characters long.`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}

/**
 * 3. Payment Submitted Confirmation
 */
export async function sendPaymentSubmittedEmail({ user, course, payment }) {
    const subject = `Payment submitted for ${course.title} — Verification pending`;

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #111827;">Payment Submitted</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>Thank you for your purchase request for <strong>${course.title}</strong>.</p>
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Course:</strong> ${course.title}</p>
        <p style="margin: 4px 0;"><strong>Amount:</strong> ₹${payment.amount}</p>
        <p style="margin: 4px 0;"><strong>Transaction Reference:</strong> ${payment.transactionReference}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> Pending Manual Verification</p>
      </div>
      <p>Our administration team is reviewing your transaction. You will receive an email as soon as your payment is approved and course access is activated.</p>
    `;

    const text = `Hello ${user.name || "there"},\n\nWe received your payment reference for ${course.title}.\nAmount: ₹${payment.amount}\nReference: ${payment.transactionReference}\nStatus: Pending Verification\n\nYou will receive an update once reviewed.`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}

/**
 * 4. Payment Approved & Enrollment Activated Notification
 */
export async function sendPaymentApprovedEmail({ user, course, payment, baseUrl }) {
    const rootUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:2000";
    const dashboardUrl = `${rootUrl}/dashboard`;
    const subject = `Payment approved! You are enrolled in ${course.title}`;

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #059669;">Payment Approved & Enrollment Active!</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>Great news! Your manual payment of <strong>₹${payment.amount}</strong> for <strong>${course.title}</strong> (Ref: ${payment.transactionReference}) has been approved.</p>
      <p>Your enrollment is now active, and you can immediately begin streaming your course lessons.</p>
      <p style="text-align: center;">
        <a href="${dashboardUrl}" class="btn">Go to Student Dashboard</a>
      </p>
    `;

    const text = `Hello ${user.name || "there"},\n\nYour payment for ${course.title} (₹${payment.amount}, Ref: ${payment.transactionReference}) has been approved!\n\nYou can access your course now on your dashboard:\n${dashboardUrl}`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}

/**
 * 5. Payment Rejected Notification
 */
export async function sendPaymentRejectedEmail({ user, course, payment, rejectionReason, baseUrl }) {
    const rootUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:2000";
    const retryUrl = `${rootUrl}/courses/${course.slug}/enroll`;
    const subject = `Update regarding your payment for ${course.title}`;

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #dc2626;">Payment Review Update</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>We reviewed your payment submission (Ref: <strong>${payment.transactionReference}</strong>) for <strong>${course.title}</strong>, but were unable to verify it.</p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason provided by administrator:</p>
        <p style="margin: 6px 0 0 0; color: #b91c1c;">${rejectionReason || "Transaction reference could not be matched."}</p>
      </div>
      <p>You can re-submit your transaction reference or updated payment proof at any time using the link below:</p>
      <p style="text-align: center;">
        <a href="${retryUrl}" class="btn">Retry Payment Submission</a>
      </p>
    `;

    const text = `Hello ${user.name || "there"},\n\nYour payment submission for ${course.title} (Ref: ${payment.transactionReference}) was not approved.\n\nReason: ${rejectionReason || "Transaction reference could not be matched."}\n\nYou can retry your payment submission here:\n${retryUrl}`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}

/**
 * 6. Direct Enrollment Activated Notification (e.g. Admin Assignment)
 */
export async function sendEnrollmentActivatedEmail({ user, course, baseUrl }) {
    const rootUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:2000";
    const dashboardUrl = `${rootUrl}/dashboard`;
    const subject = `You have been enrolled in ${course.title}`;

    const bodyContent = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #111827;">Enrollment Activated</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>You have been enrolled in <strong>${course.title}</strong>.</p>
      <p>You can now view the curriculum and begin watching lesson videos on your dashboard.</p>
      <p style="text-align: center;">
        <a href="${dashboardUrl}" class="btn">Open Course on Dashboard</a>
      </p>
    `;

    const text = `Hello ${user.name || "there"},\n\nYou have been enrolled in ${course.title}.\n\nAccess your course lessons here:\n${dashboardUrl}`;

    return sendTransactionalEmail({
        to: user.email,
        subject,
        html: wrapEmailHtml({ title: subject, bodyContent }),
        text,
    });
}
