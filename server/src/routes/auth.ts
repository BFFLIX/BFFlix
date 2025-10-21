
// server/src/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/user";
import PasswordReset from "../models/PasswordReset";
import { signToken } from "../lib/jwt";
import { generateToken, hashToken } from "../lib/resetToken";
import { sendEmail } from "../lib/mailer";

const r = Router();

// ---------- Signup ----------
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(50),
});

r.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email, password, name } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, name, passwordHash });

  const token = signToken(String(user._id));
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});

// ---------- Login ----------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

r.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(String(user._id));
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});

// ---------- Request password reset ----------
const requestResetSchema = z.object({
  email: z.string().email(),
});

r.post("/request-reset", async (req, res) => {
  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email } = parsed.data;
  const user = await User.findOne({ email }).select("_id email name").lean();

  if (!user) return res.json({ ok: true }); // Avoid enumeration

  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

  const raw = generateToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const resetUrl = `${base}/reset-password?token=${raw}`;

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
  }

  res.json({ ok: true });
});

// ---------- Complete password reset ----------
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
