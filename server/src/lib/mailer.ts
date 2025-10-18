
import nodemailer from "nodemailer";

type SendOpts = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  // Need to set up SMTP in .env for prod later 
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true", 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // DEV fallback: Ethereal test inbox (no real email goes out)
  const test = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: { user: test.user, pass: test.pass },
  });

  return transporter;
}

/**
 * Send an email. In dev, logs an Ethereal preview URL you can click.
 */
export async function sendEmail({ to, subject, html, text }: SendOpts) {
  const from = process.env.EMAIL_FROM || 'BFFlix <no-reply@bfflix.local>';
  const t = await getTransporter();
  const info = await t.sendMail({ from, to, subject, html, text });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("📧 Ethereal preview:", previewUrl);
  }

  return { messageId: info.messageId, previewUrl };
}
