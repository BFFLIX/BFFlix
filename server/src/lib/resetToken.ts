
import crypto from "crypto";

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex"); // raw token (secret)
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
