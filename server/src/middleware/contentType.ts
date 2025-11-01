
import { Request, Response, NextFunction } from "express";

export function requireJson(req: Request, res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (!ct.startsWith("application/json")) {
      return res.status(415).json({ error: "unsupported_media_type" });
    }
  }
  next();
}