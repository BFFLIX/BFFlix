
import mongoose, { Schema, Types, InferSchemaType } from "mongoose";

const circleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240 },

    // NEW: visibility (private by default)
    visibility: { type: String, enum: ["private", "public"], default: "private" },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],

    // NEW: optional invite code for private circles (null for public)
    inviteCode: { type: String, trim: true },
  },
  { timestamps: true }
);

// Ensure the creator is included in members
circleSchema.pre("validate", function (next) {
  const doc = this as any;
  if (doc.createdBy) {
    if (!Array.isArray(doc.members) || doc.members.length === 0) {
      doc.members = [doc.createdBy];
    } else if (!doc.members.some((m: Types.ObjectId) => m.equals(doc.createdBy))) {
      doc.members.push(doc.createdBy);
    }
  }
  next();
});

// Indexes (avoid inline "index: true" to prevent duplicate warnings)
circleSchema.index({ members: 1 });                    // "my circles"
circleSchema.index({ createdBy: 1 });                  // owner queries
circleSchema.index({ visibility: 1, name: 1 });        // discover public circles
circleSchema.index({ inviteCode: 1 }, { sparse: true });// lookup by invite code (optional)

export type CircleDoc = InferSchemaType<typeof circleSchema>;
export default mongoose.model("Circle", circleSchema);
