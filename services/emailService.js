const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Configure SMTP transporter if config is present, otherwise configure mock logging fallback
const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter = null;
if (hasSmtpConfig) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an email reminder to the user
 * @param {string} toEmail Recipient email
 * @param {string} username Username
 * @param {string} technology Tech name
 * @param {string} difficulty Difficulty level
 * @param {Date} scheduledAt Interview start time
 * @param {number} duration Duration in hours
 */
const sendInterviewReminder = async (toEmail, username, technology, difficulty, scheduledAt, duration) => {
  const subject = `Reminder: Your ${technology} (${difficulty}) AI Interview is in 10 minutes`;
  const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const formattedDate = new Date(scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const textContent = `Hi ${username},\n\nThis is a friendly reminder that your scheduled ${technology} (${difficulty}) AI Interview is starting in 10 minutes at ${formattedTime} on ${formattedDate}.\n\nInterview Details:\n- Technology: ${technology}\n- Difficulty: ${difficulty}\n- Duration: ${duration} hours\n\nPlease log into the HireView platform to start your session.\n\nGood luck,\nThe HireView Team`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">HireView AI Interview Reminder</h2>
      <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hi <strong>${username}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">This is a friendly reminder that your scheduled AI Interview is starting in <strong>10 minutes</strong>!</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Interview Details</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #475569;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px;">Technology:</td>
            <td style="padding: 4px 0;">${technology}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Difficulty:</td>
            <td style="padding: 4px 0;">${difficulty}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Scheduled Time:</td>
            <td style="padding: 4px 0;">${formattedTime} (${formattedDate})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Duration:</td>
            <td style="padding: 4px 0;">${duration} hours</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 15px; color: #334155; line-height: 1.6;">Please log into the HireView platform and head to your dashboard to launch your interview.</p>
      <p style="font-size: 14px; color: #64748b; margin-top: 30px;">Best of luck,<br>The HireView Team</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'HireView'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@hireview.com'}>`,
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[EMAIL SUCCESS] Sent SMTP reminder to ${toEmail}`);
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send SMTP email to ${toEmail}:`, err.message);
      // Fallback to file logging if SMTP fails
      logEmailToFile(toEmail, subject, textContent);
    }
  } else {
    // Development/mock mode: write to workspace file
    logEmailToFile(toEmail, subject, textContent);
  }
};

/**
 * Send an immediate confirmation email to the user when an interview is scheduled
 * @param {string} toEmail Recipient email
 * @param {string} username Username
 * @param {string} technology Tech name
 * @param {string} difficulty Difficulty level
 * @param {Date} scheduledAt Interview start time
 * @param {number} duration Duration in hours
 */
const sendInterviewConfirmation = async (toEmail, username, technology, difficulty, scheduledAt, duration) => {
  const subject = `Confirmation: Your ${technology} (${difficulty}) AI Interview is scheduled`;
  const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const formattedDate = new Date(scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const textContent = `Hi ${username},\n\nThank you for scheduling your ${technology} (${difficulty}) AI Interview on HireView.\n\nYour interview is confirmed for:\n- Date: ${formattedDate}\n- Time: ${formattedTime}\n- Technology: ${technology}\n- Difficulty: ${difficulty}\n- Duration: ${duration} hours\n\nYou will receive a reminder email 10 minutes before the session starts.\n\nBest regards,\nThe HireView Team`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">Interview Scheduled Successfully!</h2>
      <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hi <strong>${username}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">Thank you for scheduling your AI Interview. Your session has been successfully booked on the HireView platform.</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Scheduled Details</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #475569;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px;">Technology:</td>
            <td style="padding: 4px 0;">${technology}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Difficulty:</td>
            <td style="padding: 4px 0;">${difficulty}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Scheduled Time:</td>
            <td style="padding: 4px 0;">${formattedTime} (${formattedDate})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Duration:</td>
            <td style="padding: 4px 0;">${duration} hours</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 15px; color: #334155; line-height: 1.6;">We will send you a final reminder email 10 minutes prior to the start time with instructions to begin your session.</p>
      <p style="font-size: 14px; color: #64748b; margin-top: 30px;">Best regards,<br>The HireView Team</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'HireView'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@hireview.com'}>`,
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[EMAIL SUCCESS] Sent SMTP confirmation to ${toEmail}`);
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send SMTP confirmation email to ${toEmail}:`, err.message);
      logEmailToFile(toEmail, subject, textContent);
    }
  } else {
    logEmailToFile(toEmail, subject, textContent);
  }
};

/**
 * Log mock emails to a local file for dev verification
 */
function logEmailToFile(to, subject, content) {
  const logPath = path.join(__dirname, '..', 'sent_emails_log.txt');
  const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${to}
SUBJECT: ${subject}
CONTENT:
${content}
========================================
\n`;

  try {
    fs.appendFileSync(logPath, logEntry, 'utf8');
    console.log(`[MOCK EMAIL] Saved email notification log to: sent_emails_log.txt (Recipient: ${to})`);
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to write mock email log:', err.message);
  }
}

/**
 * Send interview cancellation email
 */
const sendInterviewCancellation = async (toEmail, interview) => {
  const subject = `Interview Cancelled: ${interview.technology} (${interview.difficulty})`;
  const textContent = `Hi ${interview.username || ''},\n\nYour scheduled interview on ${new Date(interview.scheduledAt).toLocaleString()} has been cancelled.\n\nIf you wish to reschedule, please use the HireView platform.\n\nBest regards,\nHireView Team`;
  await sendGenericEmail(toEmail, subject, textContent);
};

/**
 * Send interview reschedule email
 */
const sendInterviewReschedule = async (toEmail, interview) => {
  const subject = `Interview Rescheduled: ${interview.technology} (${interview.difficulty})`;
  const formattedTime = new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const formattedDate = new Date(interview.scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const textContent = `Hi ${interview.username || ''},\n\nYour interview has been rescheduled to ${formattedDate} at ${formattedTime}.\n\nWe look forward to seeing you then.\n\nBest regards,\nHireView Team`;
  await sendGenericEmail(toEmail, subject, textContent);
};

/**
 * Helper to send generic email using existing transporter or fallback
 */
const sendGenericEmail = async (toEmail, subject, textContent) => {
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'HireView'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@hireview.com'}>`,
        to: toEmail,
        subject,
        text: textContent,
        // no HTML needed for simple messages
      });
      console.log(`[EMAIL SUCCESS] Sent ${subject} to ${toEmail}`);
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send ${subject} to ${toEmail}:`, err.message);
      logEmailToFile(toEmail, subject, textContent);
    }
  } else {
    logEmailToFile(toEmail, subject, textContent);
  }
};

module.exports = {
  sendInterviewReminder,
  sendInterviewConfirmation,
  sendInterviewCancellation,
  sendInterviewReschedule,
};

