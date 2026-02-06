import mongoose from 'mongoose';
import dotenv from 'dotenv';
import League from './models/League.js';

dotenv.config();

const leagues = [
  // Basketball
  {
    name: 'PBA',
    sport: 'basketball',
    teams: [
      'Barangay Ginebra', 'San Miguel Beermen', 'TNT Tropang Giga',
      'Magnolia Hotshots', 'Meralco Bolts', 'NLEX Road Warriors',
      'Rain or Shine Elasto Painters', 'Phoenix Super LPG',
      'Converge FiberXers', 'Terrafirma Dyip', 'Blackwater Bossing',
      'NorthPort Batang Pier'
    ]
  },
  {
    name: 'UAAP',
    sport: 'basketball',
    teams: [
      'Ateneo Blue Eagles', 'La Salle Green Archers', 'UST Growling Tigers',
      'UP Fighting Maroons', 'FEU Tamaraws', 'NU Bulldogs',
      'Adamson Soaring Falcons', 'UE Red Warriors'
    ]
  },
  {
    name: 'NCAA',
    sport: 'basketball',
    teams: [
      'San Beda Red Lions', 'Letran Knights', 'Lyceum Pirates',
      'Mapua Cardinals', 'Arellano Chiefs', 'JRU Heavy Bombers',
      'CSB Blazers', 'EAC Generals', 'Perpetual Altas', 'St. Clare Saints'
    ]
  },
  {
    name: 'National Team',
    sport: 'basketball',
    teams: ['Gilas Pilipinas']
  },

  // Volleyball
  {
    name: 'PVL',
    sport: 'volleyball',
    teams: [
      'Creamline Cool Smashers', 'Petro Gazz Angels', 'Chery Tiggo Crossovers',
      'PLDT High Speed Hitters', 'Cignal HD Spikers', 'F2 Logistics Cargo Movers',
      'Choco Mucho Flying Titans', 'Akari Chargers'
    ]
  },
  {
    name: 'UAAP',
    sport: 'volleyball',
    teams: [
      'NU Lady Bulldogs', 'La Salle Lady Spikers',
      'Ateneo Lady Eagles', 'UST Golden Tigresses',
      'UP Fighting Maroons', 'FEU Lady Tamaraws',
      'Adamson Lady Falcons', 'UE Lady Warriors'
    ]
  },
  {
    name: 'National Team',
    sport: 'volleyball',
    teams: ['Alas Pilipinas']
  },

  // Football
  {
    name: 'National Team',
    sport: 'football',
    teams: ['Philippine Azkals']
  },
  {
    name: 'PFL',
    sport: 'football',
    teams: [
      'Kaya FC', 'United City FC', 'Stallion Laguna',
      'Maharlika Manila FC', 'Cebu FC', 'Dynamic Herb Cebu FC'
    ]
  }
];

async function seedLeagues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing leagues
    await League.deleteMany({});
    console.log('Cleared existing leagues');

    // Insert new leagues
    const result = await League.insertMany(leagues);
    console.log(`Seeded ${result.length} leagues:`);
    result.forEach(l => console.log(`  - ${l.name} (${l.sport}): ${l.teams.length} teams`));

    await mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedLeagues();
