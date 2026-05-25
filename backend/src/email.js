const nodemailer = require("nodemailer");
const config = require("./config");

let transporter;

function getTransporter() {
  if (!transporter) {
    if (!config.smtpHost) {
      throw new Error("SMTP is not configured. Set SMTP_HOST and related SMTP_* variables.");
    }

    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword,
          }
        : undefined,
    });
  }

  return transporter;
}

async function sendOtpEmail({ to, fullName, code }) {
  const mailer = getTransporter();
  const safeName = String(fullName || "").trim();
  const greeting = safeName ? `Hi ${safeName},` : "Hello,";

  await mailer.sendMail({
    from: config.smtpFrom,
    to,
    subject: "Your BankingHub verification code",
    text: `${greeting}\n\nYour one-time verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you did not initiate this login, please contact support immediately.`,
    html: `
      <p>${greeting}</p>
      <p>Your one-time verification code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p>
      <p>This code expires in 5 minutes.</p>
      <p>If you did not initiate this login, please contact support immediately.</p>
    `,
  });
}

async function sendResetTokenEmail({ to, fullName, resetUrl }) {
  const mailer = getTransporter();
  const safeName = String(fullName || "").trim();
  const greeting = safeName ? `Hi ${safeName},` : "Hello,";

  await mailer.sendMail({
    from: config.smtpFrom,
    to,
    subject: "Reset your BankingHub password",
    text: `${greeting}\n\nUse this link to reset your password:\n${resetUrl}\n\nThis link expires in 15 minutes.\n\nIf you did not request a reset, you can ignore this email.`,
    html: `
      <p>${greeting}</p>
      <p>Use this link to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 15 minutes.</p>
      <p>If you did not request a reset, you can ignore this email.</p>
    `,
  });
}

module.exports = {
  sendOtpEmail,
  sendResetTokenEmail,
};
