const mongoose = require('mongoose');

const streamingServiceSchema = new mongoose.Schema({
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

module.exports = mongoose.model('StreamingService', streamingServiceSchema);