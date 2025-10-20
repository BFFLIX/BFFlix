import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamingService extends Document {
  tmdbProviderId: number;
  name: string;
  logoPath?: string;
  displayPriority: number;
  createdAt: Date;
  updatedAt: Date;
}

const streamingServiceSchema = new Schema({
  tmdbProviderId: {
    type: Number,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  logoPath: {
    type: String,
  },
  displayPriority: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.model<IStreamingService>('StreamingService', streamingServiceSchema);