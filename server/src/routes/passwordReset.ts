
import { Router } from "express";
import { z } from "zod";
import { generateToken, hashToken } from "../lib/resetToken";
import PasswordReset from "../models/PasswordReset";
import User from "../models/user";
import bcrypt from "bcryptjs";

const r = Router();

const requestSchema = z.object({
  email: z.string().email(),
});

r.post("/request-reset", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { email } = parsed.data;

  // Normalize email (optional)
  const user = await User.findOne({ email }).lean();
  // Always respond 200 to avoid user enumeration.
  // But only create a token if the user exists.
  if (!user) {
    return res.json({ ok: true });
  }

  // Invalidate existing unused tokens (optional cleanup)
  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } }).exec();

  const raw = generateToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

  // Build a reset link; in prod you'd email it.
  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const link = `${base}/reset-password?token=${raw}`;

  // For MVP, log it so you can click it during testing:
  console.log("🔐 Password reset link for", email, "→", link);

  return res.json({ ok: true });
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

r.post("/reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await PasswordReset.findOne({ tokenHash }).exec();
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const user = await User.findById(record.userId).exec();
  if (!user) return res.status(400).json({ error: "Invalid token" });

  // Update password
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  // Mark token used (single-use)
  record.usedAt = new Date();
  await record.save();

  return res.json({ ok: true });
});

export default r;
