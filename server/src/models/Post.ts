
import mongoose, { Schema, Types, InferSchemaType } from "mongoose";

const postSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // NEW: movie vs tv
    type: { type: String, enum: ["movie", "tv"], required: true },

    tmdbId: { type: String, required: true, trim: true },

    // NEW: optional episode context (tv only)
    seasonNumber: { type: Number, min: 0 },
    episodeNumber: { type: Number, min: 0 },

    circles: {
      type: [Schema.Types.ObjectId],
      ref: "Circle",
      required: true,
      validate: [
        (arr: Types.ObjectId[]) => Array.isArray(arr) && arr.length > 0,
        "At least one circle is required",
      ],
    },

    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    watchedAt: { type: Date },
  },
  { timestamps: true }
);

// Deduplicate circle ids
postSchema.pre("validate", function (next) {
  const doc = this as any;
  if (Array.isArray(doc.circles)) {
    const seen = new Set<string>();
    doc.circles = doc.circles.filter((id: Types.ObjectId) => {
      const k = id.toString();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  // Must have some content
  if (!doc.comment && !doc.rating) {
    return next(new Error("A post must include either a comment or a rating"));
  }
  // If episodeNumber is provided, seasonNumber must exist too
  if (doc.episodeNumber != null && doc.seasonNumber == null) {
    return next(new Error("seasonNumber is required when episodeNumber is provided"));
  }
  next();
});

// Indexes
postSchema.index({ circles: 1, createdAt: -1 });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ tmdbId: 1, type: 1 }); // helpful for title-specific queries

export type PostDoc = InferSchemaType<typeof postSchema>;
export default mongoose.model("Post", postSchema);
