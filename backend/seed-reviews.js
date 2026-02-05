import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import Review from './models/Review.js';

dotenv.config();

const firstNames = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Carlos', 'Rosa', 'Miguel', 'Carmen',
  'Antonio', 'Teresa', 'Francisco', 'Sofia', 'Luis', 'Patricia', 'Rafael',
  'Isabella', 'Marco', 'Grace', 'Paolo', 'Christine', 'Renz', 'Alyssa',
  'Kenneth', 'Jasmine', 'Bryan', 'Nicole', 'Mark', 'Angelica', 'Jerome', 'Kat',
];

const lastNames = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Del Rosario', 'Garcia', 'Mendoza',
  'Torres', 'Villanueva', 'Ramos', 'Gonzales', 'Aquino', 'Flores', 'Navarro',
  'De Leon', 'Enriquez', 'Manalo', 'Hernandez', 'Diaz', 'Lopez',
];

const reviewTitles5 = [
  'Absolutely love it!', 'Best jersey I own', 'Perfect fit', 'Amazing quality',
  'Worth every peso', 'My favorite gear', 'Highly recommend!', 'Top notch!',
  'Great purchase', 'Exceeded expectations',
];

const reviewTitles4 = [
  'Really good quality', 'Happy with my purchase', 'Great value', 'Nice product',
  'Good fit and feel', 'Solid gear', 'Very satisfied', 'Would buy again',
];

const reviewTitles3 = [
  'Decent product', 'It\'s okay', 'Average quality', 'Not bad',
  'Good but could be better', 'Fair for the price',
];

const reviewTitles2 = [
  'Expected more', 'Below average', 'Sizing issues',
];

const reviewBodies5 = [
  'The quality is outstanding. The fabric feels premium and the fit is perfect. I wore this to the game and got so many compliments!',
  'This is my third purchase from Puso Pilipinas and they never disappoint. Authentic quality, fast delivery, and great customer service.',
  'Bought this for my husband and he absolutely loves it. The colors are vibrant and true to the team colors. Will definitely buy more!',
  'Perfect for game day! The material is breathable and comfortable even in the heat. Looks exactly like the photos.',
  'Super happy with this purchase. The stitching is clean, the design is sharp, and it fits like a glove. Mabuhay Pilipinas!',
  'Representing my team with pride! The quality is leagues above what you get from other stores. 100% worth the price.',
];

const reviewBodies4 = [
  'Good quality overall. The fit is slightly larger than expected but still looks great. Would recommend sizing down if you prefer a tighter fit.',
  'Really nice product, great materials. The design is accurate and the colors are spot on. Only minor issue is the delivery took a bit longer than expected.',
  'Happy with the purchase. The jersey is comfortable and well-made. My only small gripe is that the tag is a bit scratchy.',
  'Solid product for the price. Wore it to several games and it still looks brand new after washing. Very durable.',
  'Great gear! Comfortable to wear all day. The print quality is excellent. Would love to see more color options.',
];

const reviewBodies3 = [
  'It\'s a decent product for the price. The quality is acceptable but not exceptional. The fit is okay.',
  'Average quality. The design looks good but the fabric feels a bit thin compared to what I expected.',
  'Not bad overall. It does the job but I was hoping for slightly better quality at this price point.',
];

const reviewBodies2 = [
  'The sizing runs small. I ordered my usual size but it\'s tight. The quality is okay though.',
  'The colors are slightly different from what was shown in the photos. Not terrible but not what I expected.',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReview(productId, index) {
  // Weight towards 4-5 star reviews
  const weights = [1, 2, 5, 25, 67]; // 1-star to 5-star probability
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let rating = 1;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      rating = i + 1;
      break;
    }
  }

  let title, body;
  if (rating === 5) { title = randomItem(reviewTitles5); body = randomItem(reviewBodies5); }
  else if (rating === 4) { title = randomItem(reviewTitles4); body = randomItem(reviewBodies4); }
  else if (rating === 3) { title = randomItem(reviewTitles3); body = randomItem(reviewBodies3); }
  else { title = randomItem(reviewTitles2); body = randomItem(reviewBodies2); }

  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);

  // Random date within the last 6 months
  const daysAgo = Math.floor(Math.random() * 180);
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    product: productId,
    author: `${firstName} ${lastName.charAt(0)}.`,
    email: `${firstName.toLowerCase()}${index}@example.com`,
    rating,
    title,
    body,
    verified: Math.random() > 0.3,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seedReviews() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing reviews
    await Review.deleteMany({});
    console.log('Cleared existing reviews');

    const products = await Product.find({ active: true });
    console.log(`Found ${products.length} products`);

    let totalReviews = 0;

    for (const product of products) {
      // Each product gets 3-8 reviews
      const numReviews = Math.floor(Math.random() * 6) + 3;
      const reviews = [];

      for (let i = 0; i < numReviews; i++) {
        reviews.push(generateReview(product._id, totalReviews + i));
      }

      await Review.insertMany(reviews);

      // Calculate and update product avg rating
      const stats = await Review.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      ]);

      if (stats.length > 0) {
        await Product.findByIdAndUpdate(product._id, {
          avgRating: Math.round(stats[0].avgRating * 10) / 10,
          reviewCount: stats[0].reviewCount,
        });
      }

      totalReviews += numReviews;
    }

    console.log(`Seeded ${totalReviews} reviews across ${products.length} products`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding reviews:', error);
    process.exit(1);
  }
}

seedReviews();
