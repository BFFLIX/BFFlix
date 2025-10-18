
import { Schema, model, InferSchemaType } from "mongoose";

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null }, // <— Added this line
  },
  { timestamps: true }
);

// TTL index: automatically deletes after expiresAt time
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// For faster lookups by token
schema.index({ tokenHash: 1 }, { unique: true });

export type PasswordResetDoc = InferSchemaType<typeof schema>;
export default model("PasswordReset", schema);
