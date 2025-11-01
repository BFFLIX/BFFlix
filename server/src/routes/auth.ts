
// server/src/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import User from "../models/user";
import PasswordReset from "../models/PasswordReset";
import { signToken } from "../lib/jwt";
import { generateToken, hashToken } from "../lib/resetToken";
import { sendEmail } from "../lib/mailer";

const r = Router();

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

// ---------- Schemas ----------
const signupSchema = z.object({
  email: z.string().email().transform(normEmail),
  // Adjust rules if you want to keep min 6 instead
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  name: z.string().trim().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email().transform(normEmail),
  password: z.string().min(1, "Password required"),
});

const requestResetSchema = z.object({
  email: z.string().email().transform(normEmail),
});

const resetSchema = z.object({
  token: z.string().min(10),
  // Keep same policy as signup for consistency
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
});

// ---------- Signup ----------
r.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password, name } = parsed.data;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "email_already_in_use" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name: name.trim(), passwordHash });

    const token = signToken(String(user._id));
    return res
      .status(201)
      .json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err: any) {
    // Race condition safety if unique index triggers
    if (err?.code === 11000) {
      return res.status(409).json({ error: "email_already_in_use" });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------- Login ----------
r.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = signToken(String(user._id));
    return res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------- Request password reset ----------
r.post("/request-reset", async (req, res) => {
  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email } = parsed.data;

  try {
    const user = await User.findOne({ email }).select("_id email name").lean();

    // Avoid account enumeration
    if (!user) return res.json({ ok: true });

    // Invalidate prior unused tokens
    await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

    const raw = generateToken(32);
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

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
      // Email failures shouldn’t leak account info or block token creation
      console.error("Password reset email failed:", e);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Request reset error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------- Complete password reset ----------
r.post("/reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  try {
    const record = await PasswordReset.findOne({ tokenHash });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }

    const user = await User.findById(record.userId);
    if (!user) return res.status(400).json({ error: "invalid_or_expired_token" });

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    // Mark token used so it can't be reused
    record.usedAt = new Date();
    await record.save();

    // Optional: if you later add a tokenVersion field on User, bump it here to invalidate old JWTs.
    return res.json({ ok: true });
  } catch (err) {
    console.error("Reset error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default r;