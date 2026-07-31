import 'dotenv/config';
import prisma from './lib/prisma.js';
import * as leagueRepository from './repositories/leagueRepository.js';

// League.sports is now a real array field (a League — UAAP, PBA — is a
// single institution that can span multiple sports; see the Domain
// Model's "League is itself an Organization" note). The old per-(name,
// sport) seed rows are merged here into one row per name, unioning
// sports/teams — the schema's `name @unique` constraint requires it, and
// it matches the actual domain model rather than a database quirk.
const leagues = [
  {
    name: 'PBA',
    sports: ['basketball'],
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
    sports: ['basketball', 'volleyball'],
    teams: [
      'Ateneo Blue Eagles', 'La Salle Green Archers', 'UST Growling Tigers',
      'UP Fighting Maroons', 'FEU Tamaraws', 'NU Bulldogs',
      'Adamson Soaring Falcons', 'UE Red Warriors',
      'NU Lady Bulldogs', 'La Salle Lady Spikers',
      'Ateneo Lady Eagles', 'UST Golden Tigresses',
      'FEU Lady Tamaraws', 'Adamson Lady Falcons', 'UE Lady Warriors'
    ]
  },
  {
    name: 'NCAA',
    sports: ['basketball'],
    teams: [
      'San Beda Red Lions', 'Letran Knights', 'Lyceum Pirates',
      'Mapua Cardinals', 'Arellano Chiefs', 'JRU Heavy Bombers',
      'CSB Blazers', 'EAC Generals', 'Perpetual Altas', 'St. Clare Saints'
    ]
  },
  {
    name: 'National Team',
    sports: ['basketball', 'volleyball', 'football'],
    teams: ['Gilas Pilipinas', 'Alas Pilipinas', 'Philippine Azkals']
  },
  {
    name: 'PVL',
    sports: ['volleyball'],
    teams: [
      'Creamline Cool Smashers', 'Petro Gazz Angels', 'Chery Tiggo Crossovers',
      'PLDT High Speed Hitters', 'Cignal HD Spikers', 'F2 Logistics Cargo Movers',
      'Choco Mucho Flying Titans', 'Akari Chargers'
    ]
  },
  {
    name: 'PFL',
    sports: ['football'],
    teams: [
      'Kaya FC', 'United City FC', 'Stallion Laguna',
      'Maharlika Manila FC', 'Cebu FC', 'Dynamic Herb Cebu FC'
    ]
  }
];

async function seedLeagues() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Connected to PostgreSQL');

    // Clear existing leagues
    await prisma.league.deleteMany({});
    console.log('Cleared existing leagues');

    // Insert new leagues
    const result = await Promise.all(leagues.map((l) => leagueRepository.create(l)));
    console.log(`Seeded ${result.length} leagues:`);
    result.forEach(l => console.log(`  - ${l.name} (${l.sports.join(', ')}): ${l.teams.length} teams`));

    console.log('Done!');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedLeagues();
