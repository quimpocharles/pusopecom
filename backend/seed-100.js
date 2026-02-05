import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

// Philippine sports teams data
const teams = {
  basketball: [
    'Barangay Ginebra San Miguel', 'San Miguel Beermen', 'TNT Tropang Giga',
    'Magnolia Hotshots', 'Meralco Bolts', 'NLEX Road Warriors',
    'Rain or Shine Elasto Painters', 'Phoenix Super LPG Fuel Masters',
    'Converge FiberXers', 'Terrafirma Dyip', 'Blackwater Bossing',
    'Northport Batang Pier', 'Gilas Pilipinas',
    'UST Growling Tigers', 'Ateneo Blue Eagles', 'La Salle Green Archers',
    'UP Fighting Maroons', 'FEU Tamaraws', 'NU Bulldogs',
    'Adamson Soaring Falcons', 'UE Red Warriors',
  ],
  volleyball: [
    'Creamline Cool Smashers', 'Petro Gazz Angels', 'Chery Tiggo Crossovers',
    'PLDT High Speed Hitters', 'Cignal HD Spikers', 'F2 Logistics Cargo Movers',
    'Choco Mucho Flying Titans', 'Akari Chargers',
    'NU Lady Bulldogs', 'La Salle Lady Spikers', 'Ateneo Lady Eagles',
    'UST Golden Tigresses', 'Alas Pilipinas',
  ],
  football: [
    'Philippine Azkals', 'Kaya FC-Iloilo', 'United City FC',
    'Stallion Laguna FC', 'Maharlika Manila FC', 'Cebu FC',
    'Dynamic Herb Cebu FC', 'Mendiola FC 1991',
  ],
};

// Color palettes for placeholder images (hex without #)
const colors = {
  basketball: [
    { bg: 'DC2626', fg: 'FFFFFF' }, // Red/White (Ginebra)
    { bg: '1E3A8A', fg: 'FCD34D' }, // Blue/Gold (SMB)
    { bg: '000000', fg: 'F59E0B' }, // Black/Gold (TNT)
    { bg: 'DC2626', fg: 'FFFFFF' }, // Red/White (Magnolia)
    { bg: 'F97316', fg: '1E3A8A' }, // Orange/Blue (Meralco)
    { bg: '16A34A', fg: 'FFFFFF' }, // Green/White (NLEX)
    { bg: 'FACC15', fg: '1E3A8A' }, // Yellow/Blue (ROS)
    { bg: 'DC2626', fg: 'F59E0B' }, // Red/Gold (Phoenix)
    { bg: '2563EB', fg: 'FFFFFF' }, // Blue/White (Converge)
    { bg: '854D0E', fg: 'FFFFFF' }, // Brown/White (Terrafirma)
    { bg: '1F2937', fg: 'FFFFFF' }, // Dark/White (Blackwater)
    { bg: '0EA5E9', fg: 'FFFFFF' }, // Cyan/White (Northport)
    { bg: '0A2463', fg: 'FFFFFF' }, // Navy/White (Gilas)
    { bg: 'F59E0B', fg: '1F2937' }, // Gold/Dark (UST)
    { bg: '1E40AF', fg: 'FFFFFF' }, // Blue/White (ADMU)
    { bg: '16A34A', fg: 'FFFFFF' }, // Green/White (DLSU)
    { bg: '7C2D12', fg: 'FFFFFF' }, // Maroon/White (UP)
    { bg: '15803D', fg: 'F59E0B' }, // Green/Gold (FEU)
    { bg: 'F59E0B', fg: '1E3A8A' }, // Gold/Blue (NU)
    { bg: '1E40AF', fg: 'FFFFFF' }, // Blue/White (Adamson)
    { bg: 'DC2626', fg: 'FFFFFF' }, // Red/White (UE)
  ],
  volleyball: [
    { bg: 'EC4899', fg: 'FFFFFF' }, // Pink/White (Creamline)
    { bg: '16A34A', fg: 'F59E0B' }, // Green/Gold (Petro Gazz)
    { bg: 'F97316', fg: '1F2937' }, // Orange/Dark (Chery Tiggo)
    { bg: '2563EB', fg: 'FFFFFF' }, // Blue/White (PLDT)
    { bg: '0EA5E9', fg: '1F2937' }, // Cyan/Dark (Cignal)
    { bg: 'DC2626', fg: 'FFFFFF' }, // Red/White (F2)
    { bg: '92400E', fg: 'F59E0B' }, // Brown/Gold (Choco Mucho)
    { bg: '7C3AED', fg: 'FFFFFF' }, // Purple/White (Akari)
    { bg: 'F59E0B', fg: '1E3A8A' }, // Gold/Blue (NU)
    { bg: '16A34A', fg: 'FFFFFF' }, // Green/White (DLSU)
    { bg: '1E40AF', fg: 'FFFFFF' }, // Blue/White (ADMU)
    { bg: 'F59E0B', fg: '1F2937' }, // Gold/Dark (UST)
    { bg: '0A2463', fg: 'CE1126' }, // Navy/Red (Alas)
  ],
  football: [
    { bg: '0A2463', fg: 'FFFFFF' }, // Navy/White (Azkals)
    { bg: '16A34A', fg: 'FFFFFF' }, // Green/White (Kaya)
    { bg: 'F59E0B', fg: '1F2937' }, // Gold/Dark (United City)
    { bg: '1E40AF', fg: 'FFFFFF' }, // Blue/White (Stallion)
    { bg: 'DC2626', fg: 'F59E0B' }, // Red/Gold (Maharlika)
    { bg: 'FACC15', fg: '1E3A8A' }, // Yellow/Blue (Cebu)
    { bg: '0EA5E9', fg: 'FFFFFF' }, // Cyan/White (Dynamic Herb)
    { bg: '7C2D12', fg: 'FFFFFF' }, // Brown/White (Mendiola)
  ],
};

const categories = ['jersey', 'tshirt', 'cap', 'shorts', 'accessories'];
const categoryLabels = {
  jersey: ['Home Jersey', 'Away Jersey', 'Third Jersey', 'Jersey', 'Replica Jersey', 'Fan Jersey', 'Authentic Jersey'],
  tshirt: ['Training Shirt', 'Fan Tee', 'Graphic Tee', 'Cotton Tee', 'Dri-Fit Shirt', 'Warmup Shirt'],
  cap: ['Snapback Cap', 'Fitted Cap', 'Dad Hat', 'Trucker Cap', 'Performance Cap'],
  shorts: ['Game Shorts', 'Training Shorts', 'Fan Shorts', 'Performance Shorts', 'Sweat Shorts'],
  accessories: ['Wristband Set', 'Lanyard', 'Tumbler', 'Face Towel', 'Drawstring Bag', 'Phone Case', 'Keychain', 'Sticker Pack'],
};

const priceRanges = {
  jersey: { min: 1299, max: 2499 },
  tshirt: { min: 599, max: 1299 },
  cap: { min: 399, max: 899 },
  shorts: { min: 699, max: 1499 },
  accessories: { min: 199, max: 799 },
};

const sizeSets = {
  jersey: ['S', 'M', 'L', 'XL', '2XL'],
  tshirt: ['S', 'M', 'L', 'XL', '2XL'],
  cap: ['One Size'],
  shorts: ['S', 'M', 'L', 'XL'],
  accessories: ['One Size'],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function generatePlaceholderImage(teamName, bg, fg, category) {
  const label = encodeURIComponent(teamName.split(' ').slice(0, 2).join(' '));
  return `https://placehold.co/600x600/${bg}/${fg}?text=${label}+${category}`;
}

function generateProducts() {
  const products = [];
  const usedSlugs = new Set();
  let count = 0;

  const sports = ['basketball', 'volleyball', 'football'];

  // Distribution: ~50 basketball, ~30 volleyball, ~20 football
  const distribution = [
    { sport: 'basketball', count: 50 },
    { sport: 'volleyball', count: 30 },
    { sport: 'football', count: 20 },
  ];

  for (const { sport, count: sportCount } of distribution) {
    const sportTeams = teams[sport];
    const sportColors = colors[sport];

    for (let i = 0; i < sportCount; i++) {
      const teamIndex = i % sportTeams.length;
      const team = sportTeams[teamIndex];
      const color = sportColors[teamIndex % sportColors.length];

      // Pick category with weighted distribution favoring jerseys/tshirts
      let category;
      const catRoll = Math.random();
      if (catRoll < 0.35) category = 'jersey';
      else if (catRoll < 0.60) category = 'tshirt';
      else if (catRoll < 0.75) category = 'shorts';
      else if (catRoll < 0.88) category = 'cap';
      else category = 'accessories';

      const label = pick(categoryLabels[category]);
      const season = pick(['2024', '2025', '2024-25']);
      const name = `${team} ${label} ${season}`;

      let slug = makeSlug(name);
      // Ensure unique slug
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${randomInt(1, 999)}`;
      }
      usedSlugs.add(slug);

      const range = priceRanges[category];
      const price = Math.round(randomInt(range.min, range.max) / 50) * 50; // Round to nearest 50
      const hasSale = Math.random() < 0.25; // 25% chance of sale
      const salePrice = hasSale ? Math.round((price * (1 - randomInt(10, 30) / 100)) / 50) * 50 : undefined;

      const sizes = sizeSets[category].map(size => ({
        size,
        stock: randomInt(3, 25),
      }));

      const image = generatePlaceholderImage(team, color.bg, color.fg, category.charAt(0).toUpperCase() + category.slice(1));

      const descriptions = {
        jersey: `Official ${team} ${label.toLowerCase()} for the ${season} season. Premium quality, authentic design. Rep your team with pride! Made with breathable fabric for ultimate comfort during game day.`,
        tshirt: `${team} ${label.toLowerCase()} - perfect for everyday wear or training sessions. Comfortable cotton-blend fabric with official team branding. Show your support for ${team}!`,
        cap: `${team} ${label.toLowerCase()} - official licensed headwear. Adjustable fit, embroidered team logo. Perfect for game day or casual wear. One size fits most.`,
        shorts: `${team} ${label.toLowerCase()} for the ${season} season. Lightweight, breathable material with team colors. Perfect for training or casual wear.`,
        accessories: `Official ${team} ${label.toLowerCase()}. Licensed merchandise - the perfect gift for any ${team} fan. High-quality materials with official team branding.`,
      };

      count++;

      products.push({
        name,
        slug,
        description: descriptions[category],
        price,
        ...(salePrice && { salePrice }),
        category,
        sport,
        team,
        images: [image],
        sizes,
        featured: count <= 16, // First 16 products are featured
        active: true,
      });
    }
  }

  return products;
}

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear ALL existing products first
    const deleted = await Product.deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} existing products`);

    // Generate and insert 100 products
    const products = generateProducts();
    console.log(`\nSeeding ${products.length} products...\n`);

    let created = 0;
    for (const productData of products) {
      const product = new Product(productData);
      await product.save();
      created++;
      const tag = productData.featured ? ' ★ FEATURED' : '';
      const sale = productData.salePrice ? ` (SALE: ₱${productData.salePrice})` : '';
      console.log(`  [${created}/${products.length}] ${productData.name} — ₱${productData.price}${sale}${tag}`);
    }

    // Summary
    const bball = products.filter(p => p.sport === 'basketball').length;
    const vball = products.filter(p => p.sport === 'volleyball').length;
    const fball = products.filter(p => p.sport === 'football').length;
    const featured = products.filter(p => p.featured).length;
    const onSale = products.filter(p => p.salePrice).length;

    console.log(`\n✓ Seeding complete!`);
    console.log(`  Basketball: ${bball} | Volleyball: ${vball} | Football: ${fball}`);
    console.log(`  Featured: ${featured} | On Sale: ${onSale}`);
    console.log(`  Total: ${products.length} products`);
    console.log(`\nView at: http://localhost:5173/products`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();
