import mongoose from 'mongoose';

const leagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'League name is required'],
    trim: true
  },
  sports: {
    type: [String],
    required: [true, 'At least one sport is required'],
    enum: ['basketball', 'volleyball', 'football', 'general'],
    validate: {
      validator: (v) => v.length > 0,
      message: 'At least one sport is required'
    }
  },
  teams: [{
    type: String,
    trim: true
  }],
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

leagueSchema.index({ name: 1 }, { unique: true });

const League = mongoose.model('League', leagueSchema);

export default League;
