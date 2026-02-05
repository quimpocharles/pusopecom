import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  author: {
    type: String,
    required: [true, 'Author name is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    trim: true,
    maxLength: 120,
  },
  body: {
    type: String,
    trim: true,
    maxLength: 2000,
  },
  verified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// One review per email per product
reviewSchema.index({ product: 1, email: 1 }, { unique: true, sparse: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
