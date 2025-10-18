
import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import User from "../models/user";
import PasswordReset from "../models/PasswordReset"; // assume you have this
import { sendEmail } from "../lib/mailer";

const r = Router();

const requestResetSchema = z.object({
  email: z.string().email(),
});

// POST /auth/request-reset
r.post("/request-reset", async (req, res) => {
  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email } = parsed.data;
  const user = await User.findOne({ email }).select("_id email name").lean();

  // Always respond 200 to avoid account enumeration
  if (!user) {
    return res.json({ ok: true });
  }

  // Create token (30 min expiry)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await PasswordReset.create({
    userId: user._id,
    token,
    expiresAt,
  });

  // Build link for the frontend page that handles reset
  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const resetUrl = `${base}/reset-password?token=${token}`;

  // Email content
  const subject = "Reset your BFFlix password";
  const text = `Hi${user.name ? " " + user.name : ""},\n\nWe received a request to reset your BFFlix password.\n\nReset link (valid 30 minutes): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Reset your BFFlix password</h2>
      <p>Hi${user.name ? " " + user.name : ""},</p>
      <p>We received a request to reset your BFFlix password.</p>
      <p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
          Reset Password
        </a>
      </p>
      <p>This link expires in <strong>30 minutes</strong>. If you didn’t request this, you can ignore this email.</p>
      <p style="color:#666">If the button doesn’t work, paste this URL in your browser:<br/>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
  `;

  try {
    const { previewUrl } = await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });

    // In dev, Ethereal gives a preview link you can click
    if (previewUrl && process.env.NODE_ENV !== "production") {
      console.log("🔗 Reset email preview:", previewUrl);
    }
  } catch (err) {
    console.error("Password reset email failed:", err);
    // Still return ok to avoid leaking existence of user accounts
  }

  return res.json({ ok: true });
});

export default r;
