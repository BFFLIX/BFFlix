
// server/src/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/user";
import PasswordReset from "../models/PasswordReset";
import { generateToken, hashToken } from "../lib/resetToken";
import { sendEmail } from "../lib/mailer";

const r = Router();

// ---------- Request reset ----------
const requestResetSchema = z.object({
  email: z.string().email(),
});

r.post("/request-reset", async (req, res) => {
  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email } = parsed.data;
  const user = await User.findOne({ email }).select("_id email name").lean();

  // Always return ok to avoid account enumeration
  if (!user) return res.json({ ok: true });

  // Invalidate outstanding unused tokens for this user
  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

  // Create new token
  const raw = generateToken(32);             // e.g. 64-char hex
  const tokenHash = hashToken(raw);          // e.g. 64-char hex SHA-256
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  // Debug (optional): confirm lengths
  console.log("[reset] raw:", raw.length, "hash:", tokenHash.length);

  await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

  // Build reset link (frontend route)
  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const resetUrl = `${base}/reset-password?token=${raw}`;

  // Send email (uses Ethereal in dev automatically)
  const subject = "Reset your BFFlix password";
  const text = `Hi${user.name ? " " + user.name : ""}, reset link (30 min): ${resetUrl}`;
  const html = `<p>Hi${user.name ? " " + user.name : ""},</p>
                <p>Click to reset (expires in 30 min): 
                <a href="${resetUrl}">Reset Password</a></p>`;

  try {
    const { previewUrl } = await sendEmail({ to: user.email, subject, text, html });
    if (previewUrl && process.env.NODE_ENV !== "production") {
      console.log("🔗 Email preview:", previewUrl);
    }
  } catch (e) {
    console.error("Password reset email failed:", e);
    // Still return ok to avoid account enumeration
  }

  res.json({ ok: true });
});

// ---------- Complete reset ----------
const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

r.post("/reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await PasswordReset.findOne({ tokenHash });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const user = await User.findById(record.userId);
  if (!user) return res.status(400).json({ error: "Invalid token" });

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  record.usedAt = new Date();
  await record.save();

  res.json({ ok: true });
});

export default r;
