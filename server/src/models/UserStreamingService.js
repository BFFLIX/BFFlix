const mongoose = require('mongoose');

const userStreamingServiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  streamingServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StreamingService',
    required: true,
  },
}, {
  timestamps: true,
});

// Ensure a user can't add the same service twice
userStreamingServiceSchema.index({ userId: 1, streamingServiceId: 1 }, { unique: true });

module.exports = mongoose.model('UserStreamingService', userStreamingServiceSchema);