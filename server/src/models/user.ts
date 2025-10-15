
import mongoose from "mongoose";

export const SERVICES = ["netflix","hulu","max","prime","disney","peacock"] as const;
export type Service = typeof SERVICES[number];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    services: [{ type: String, enum: SERVICES, default: [] }],
  },
  { timestamps: true }
);

// Be explicit: create a unique index for email
userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
