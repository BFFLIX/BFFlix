
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(sub: string) {
  return jwt.sign({ sub }, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, secret) as { sub: string };
}
