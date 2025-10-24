import mongoose, { Schema, Document } from 'mongoose';

export interface IUserStreamingService extends Document {
  userId: mongoose.Types.ObjectId;
  streamingServiceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userStreamingServiceSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  streamingServiceId: {
    type: Schema.Types.ObjectId,
    ref: 'StreamingService',
    required: true,
  },
}, {
  timestamps: true,
});

userStreamingServiceSchema.index({ userId: 1, streamingServiceId: 1 }, { unique: true });

export default mongoose.model<IUserStreamingService>('UserStreamingService', userStreamingServiceSchema);