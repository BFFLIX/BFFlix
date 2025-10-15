
// server/src/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import User from "../models/user";
import { signToken } from "../lib/jwt";

const r = Router();

/**
 * Validation schemas
 */
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /auth/signup
 * - Validates input
 * - Hashes password
 * - Creates user (unique email)
 * - Returns JWT
 */
r.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }

    const { email, password, name } = parsed.data;

    // Optional fast check to give a friendly error quickly
    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });

    const token = signToken(user.id);
    return res.json({ token });
  } catch (err: any) {
    // Handle unique index violation from Mongo in case of race conditions
    if (err?.code === 11000 && err?.keyPattern?.email) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
});

/**
 * POST /auth/login
 * - Validates input
 * - Verifies user & password
 * - Returns JWT
 */
r.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user.id);
    return res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
});

export default r;
