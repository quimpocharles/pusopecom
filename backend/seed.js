import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const testProducts = [
  {
    name: 'Gilas Pilipinas Training Shirt',
    slug: 'gilas-pilipinas-training-shirt',
    description: 'Official Gilas Pilipinas training shirt. Show your support for the Philippine national basketball team with this premium quality jersey. Perfect for game day, training, or everyday wear.',
    price: 1500,
    category: 'tshirt',
    sport: 'basketball',
    team: 'Gilas Pilipinas',
    images: [
      'https://assets.adidas.com/images/w_600,f_auto,q_auto/df46ade3b67d4e48bdfd6989c73b34a3_9366/Gilas_Training_Shirt_White_KL6610_21_model.jpg'
    ],
    sizes: [
      { size: 'S', stock: 10 },
      { size: 'M', stock: 15 },
      { size: 'L', stock: 20 },
      { size: 'XL', stock: 12 },
      { size: '2XL', stock: 8 }
    ],
    featured: true,
    active: true
  },
  {
    name: 'Ginebra San Miguel Home Jersey 2024',
    slug: 'ginebra-san-miguel-home-jersey-2024',
    description: 'Official Barangay Ginebra San Miguel home jersey for the 2024 PBA season. Never say die! Rep your favorite PBA team with authentic merchandise.',
    price: 1899,
    salePrice: 1499,
    category: 'jersey',
    sport: 'basketball',
    team: 'Barangay Ginebra San Miguel',
    images: [
      'https://via.placeholder.com/600x600/DC2626/FFFFFF?text=Ginebra+Jersey'
    ],
    sizes: [
      { size: 'S', stock: 8 },
      { size: 'M', stock: 12 },
      { size: 'L', stock: 15 },
      { size: 'XL', stock: 10 }
    ],
    featured: true,
    active: true
  },
  {
    name: 'San Mig Beermen Jersey',
    slug: 'san-mig-beermen-jersey',
    description: 'Official San Miguel Beermen jersey. Premium quality basketball jersey for the most decorated team in PBA history.',
    price: 1799,
    category: 'jersey',
    sport: 'basketball',
    team: 'San Miguel Beermen',
    images: [
      'https://via.placeholder.com/600x600/1E40AF/FFFFFF?text=SMB+Jersey'
    ],
    sizes: [
      { size: 'S', stock: 5 },
      { size: 'M', stock: 10 },
      { size: 'L', stock: 12 },
      { size: 'XL', stock: 8 }
    ],
    featured: true,
    active: true
  },
  {
    name: 'Creamline Cool Smashers Volleyball Jersey',
    slug: 'creamline-cool-smashers-volleyball-jersey',
    description: 'Official Creamline Cool Smashers volleyball jersey from the Premier Volleyball League. Support the most popular women\'s volleyball team in the Philippines!',
    price: 1299,
    category: 'jersey',
    sport: 'volleyball',
    team: 'Creamline Cool Smashers',
    images: [
      'https://via.placeholder.com/600x600/EC4899/FFFFFF?text=Creamline+Jersey'
    ],
    sizes: [
      { size: 'S', stock: 15 },
      { size: 'M', stock: 20 },
      { size: 'L', stock: 18 },
      { size: 'XL', stock: 10 }
    ],
    featured: true,
    active: true
  },
  {
    name: 'Philippines Azkals Football Jersey',
    slug: 'philippines-azkals-football-jersey',
    description: 'Official Philippine Azkals national football team jersey. Show your pride for Philippine football!',
    price: 1699,
    category: 'jersey',
    sport: 'football',
    team: 'Philippine Azkals',
    images: [
      'https://via.placeholder.com/600x600/16A34A/FFFFFF?text=Azkals+Jersey'
    ],
    sizes: [
      { size: 'S', stock: 8 },
      { size: 'M', stock: 12 },
      { size: 'L', stock: 10 },
      { size: 'XL', stock: 6 }
    ],
    featured: true,
    active: true
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing products (optional - comment out if you want to keep existing)
    // await Product.deleteMany({});
    // console.log('Cleared existing products');

    // Insert test products
    for (const productData of testProducts) {
      const existing = await Product.findOne({ slug: productData.slug });
      if (existing) {
        console.log(`Product already exists: ${productData.name}`);
      } else {
        const product = new Product(productData);
        await product.save();
        console.log(`Created: ${productData.name}`);
      }
    }

    console.log('\nSeeding completed successfully!');
    console.log(`\nYou can now view the products at: http://localhost:5173/products`);
    console.log(`Or directly: http://localhost:5173/products/gilas-pilipinas-training-shirt`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();
