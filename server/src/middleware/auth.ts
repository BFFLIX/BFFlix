
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import User from "../models/user";

// extend Express Request to carry user info
export interface AuthedRequest extends Request {
  user?: { id: string; isAdmin?: boolean };
}

// main middleware
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const payload = verifyToken(token) as { sub: string };
    const user = await User.findById(payload.sub).select("_id isAdmin").lean();
  
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = { id: String(user._id), isAdmin: !!user.isAdmin };


    req.user = { id: String(user._id) };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
