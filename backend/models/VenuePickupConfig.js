import mongoose from 'mongoose';

const venuePickupConfigSchema = new mongoose.Schema({
  enabled:             { type: Boolean, default: false },
  venueName:           { type: String },
  venueAddress:        { type: String },
  pickupDate:          { type: Date },
  pickupHours:         { type: String },
  specialInstructions: { type: String },
  updatedAt:           { type: Date, default: Date.now },
});

venuePickupConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const VenuePickupConfig =
  mongoose.models.VenuePickupConfig ||
  mongoose.model('VenuePickupConfig', venuePickupConfigSchema);

export default VenuePickupConfig;
