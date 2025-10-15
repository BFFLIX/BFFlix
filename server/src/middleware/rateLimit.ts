
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: 5,                      // limit to 10 requests per minute per IP
  message: { error: "Too many requests, slow down." },
  standardHeaders: true,        // return rate limit info in headers
  legacyHeaders: false,
});
