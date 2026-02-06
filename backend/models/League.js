import mongoose from 'mongoose';

const leagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'League name is required'],
    trim: true
  },
  sport: {
    type: String,
    required: [true, 'Sport is required'],
    enum: ['basketball', 'volleyball', 'football', 'general']
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

// Unique constraint on name + sport combination
leagueSchema.index({ name: 1, sport: 1 }, { unique: true });

const League = mongoose.model('League', leagueSchema);

export default League;
