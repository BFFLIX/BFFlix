
import mongoose, { Schema, Document } from "mongoose";

export interface IAgentCache extends Document {
  userId?: mongoose.Types.ObjectId;
  query: string;
  response: any;
  createdAt: Date;
}

const agentCacheSchema = new Schema<IAgentCache>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    query: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Cache expires after 24h
agentCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IAgentCache>("AgentCache", agentCacheSchema);