
import mongoose, { Schema, Document } from "mongoose";

export interface IRecommendationCache extends Document {
  userId: mongoose.Types.ObjectId;
  query: string;
  results: any;
  expiresAt: Date;
}

const recommendationCacheSchema = new Schema<IRecommendationCache>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    query: { type: String, required: true },
    results: { type: Array, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Optional: auto-expire cache entries
recommendationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recommendationCacheSchema.index({ userId: 1, query: 1 }, { unique: true });

export default mongoose.model<IRecommendationCache>(
  "RecommendationCache",
  recommendationCacheSchema
);