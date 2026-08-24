import nodemailer from 'nodemailer';

// --- Gmail SMTP Transporter Configuration ---
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Sends an email using Gmail SMTP.
 * Falls back gracefully to console logging if SMTP credentials are not configured.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  const fromAddress = process.env.EMAIL_FROM || `Indoor Management System <${process.env.SMTP_USER || 'no-reply@daruntech.com'}>`;

  if (transporter && to) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });
      console.log(`✉️ Email sent successfully to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ Gmail SMTP Send Error (${to}):`, err.message);
      return { success: false, error: err.message };
    }
  }

  // Developer / Fallback Log
  console.log(`[MOCK GMAIL SMTP LOG] To: ${to} | Subject: ${subject}`);
  return { success: true, mock: true };
};

/**
 * Sends Login Security Alert Email for Super Admin, Admin, and Staff Logins.
 */
export const sendLoginAlertEmail = async ({ to, name, role, ipAddress = '127.0.0.1', device = 'Web Browser' }) => {
  const loginTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
  const subject = `🔒 Security Alert: New ${role} Login to Indoor Management System`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; rounded-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #7c3aed; margin-bottom: 16px;">Indoor Management System</h2>
      <h3 style="color: #18181b; margin-bottom: 12px;">New Account Sign-in Alert</h3>
      <p style="color: #52525b; font-size: 14px; line-height: 1.5;">Hello <strong>${name || role}</strong>,</p>
      <p style="color: #52525b; font-size: 14px; line-height: 1.5;">Your account was recently accessed with the <strong>${role}</strong> profile.</p>
      <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #27272a;">
        <div><strong>Role:</strong> ${role}</div>
        <div><strong>Time:</strong> ${loginTime} (BST)</div>
        <div><strong>Device / Browser:</strong> ${device}</div>
      </div>
      <p style="color: #71717a; font-size: 12px;">If this was you, no action is required. If you did not authorize this login, please change your password immediately or contact Darun Tech support.</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

/**
 * Sends Staff Account Creation Welcome Email.
 */
export const sendStaffWelcomeEmail = async ({ to, name, username, tempPassword, role, loginUrl }) => {
  const subject = `🎉 Welcome to Indoor Management System — Your Staff Account Details`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #7c3aed; margin: 0; font-size: 24px;">Indoor Management System</h1>
        <p style="color: #71717a; font-size: 13px; margin-top: 4px;">Staff Account Registration</p>
      </div>
      <p style="color: #27272a; font-size: 15px;">Hello <strong>${name}</strong>,</p>
      <p style="color: #52525b; font-size: 14px; line-height: 1.5;">An administrator has created a new staff management account for you with the role of <strong>${role}</strong>.</p>
      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #6b21a8; font-size: 14px;">🔑 Your Credentials</h4>
        <div style="font-size: 13px; color: #374151; margin-bottom: 6px;"><strong>Username:</strong> ${username}</div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 6px;"><strong>Password:</strong> ${tempPassword}</div>
        <div style="font-size: 13px; color: #374151;"><strong>Access Link:</strong> <a href="${loginUrl || 'http://localhost:5173/admin/login'}" style="color: #7c3aed; font-weight: bold;">Login to Staff Portal</a></div>
      </div>
      <p style="color: #6b7280; font-size: 12px; line-height: 1.5;">Please log in and update your password under Admin Settings for security.</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};
