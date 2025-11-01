
import { Request, Response, NextFunction } from "express";
import { isDbReady } from "../db";

export function requireDbReady(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health") return next();
  if (!isDbReady()) return res.status(503).json({ error: "db_unavailable" });
  next();
}