import mongoose from 'mongoose';

const pickupSlotSchema = new mongoose.Schema({
  pickupDate:          { type: String },  // "YYYY-MM-DD" — stored as string to avoid timezone shifts
  pickupHours:         { type: String },  // display string e.g. "3:00 PM – 9:00 PM"
  pickupStartTime:     { type: String },  // "HH:MM" 24h in PHT (UTC+8), used for deadline computation
  specialInstructions: { type: String },
  enabled:             { type: Boolean, default: true },
}, { _id: true });

const venuePickupConfigSchema = new mongoose.Schema({
  enabled:       { type: Boolean, default: false },
  venueName:     { type: String },
  venueAddress:  { type: String },
  deadlineHours: { type: Number, default: 6 },   // hours before pickupStartTime to hide the slot
  slots:         { type: [pickupSlotSchema], default: [] },
  updatedAt:     { type: Date, default: Date.now },
});

venuePickupConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const VenuePickupConfig =
  mongoose.models.VenuePickupConfig ||
  mongoose.model('VenuePickupConfig', venuePickupConfigSchema);

export default VenuePickupConfig;
