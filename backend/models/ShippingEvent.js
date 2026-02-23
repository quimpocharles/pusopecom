import mongoose from 'mongoose';

const shippingEventSchema = new mongoose.Schema({
  orderId:        { type: String, required: true },
  shippingMethod: { type: String, required: true },
  orderTotal:     { type: Number, required: true },
  region:         { type: String },
  createdAt:      { type: Date, default: Date.now },
});

const ShippingEvent =
  mongoose.models.ShippingEvent ||
  mongoose.model('ShippingEvent', shippingEventSchema);

export default ShippingEvent;
