import mongoose from 'mongoose';

const tryOnLogSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true
  },
  productName: String,
  productImage: String,
  success: Boolean
}, { timestamps: true });

tryOnLogSchema.index({ createdAt: -1 });

const TryOnLog = mongoose.model('TryOnLog', tryOnLogSchema);
export default TryOnLog;
