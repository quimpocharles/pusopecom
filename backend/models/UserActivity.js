import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: ['view', 'search']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  query: {
    type: String,
    default: null
  },
  category: {
    type: String,
    default: null
  },
  sport: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// TTL index — auto-expire after 90 days
userActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Lookup indexes
userActivitySchema.index({ user: 1, type: 1 });
userActivitySchema.index({ sessionId: 1, type: 1 });

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

export default UserActivity;
