
import mongoose, { Schema, InferSchemaType } from "mongoose";

const viewingSchema = new Schema(
  {
    userId:  { type: Schema.Types.ObjectId, ref: "User", required: true },

    // movie vs tv
    type:    { type: String, enum: ["movie", "tv"], required: true },
    tmdbId:  { type: String, required: true, trim: true },

    // optional episode context (tv)
    seasonNumber: { type: Number, min: 0 },
    episodeNumber:{ type: Number, min: 0 },

    rating:   { type: Number, min: 1, max: 5 },
    comment:  { type: String, trim: true, maxlength: 1000 },
    watchedAt:{ type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Indexes
viewingSchema.index({ userId: 1, watchedAt: -1 });
viewingSchema.index({ tmdbId: 1, type: 1 });

export type ViewingDoc = InferSchemaType<typeof viewingSchema>;
export default mongoose.model("Viewing", viewingSchema);
