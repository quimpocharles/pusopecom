import 'dotenv/config';
import { readFileSync } from 'fs';
import * as productRepo from '../../repositories/productRepository.js';
import prisma from '../../lib/prisma.js';

/**
 * The actual write step — everything before this (parse, extract, upload,
 * preview) was read-only or additive-to-Cloudinary-only. This is the one
 * script in this import that touches the production database.
 *
 * Each product is created independently, not inside one shared
 * transaction across all 100 — these are 100 unrelated inventory records,
 * not one atomic business operation, so a failure on product 47 should
 * not undo the 46 that already succeeded. Every success/failure is
 * reported individually at the end rather than silently continuing.
 */
async function main() {
  const products = JSON.parse(readFileSync('scripts/uaapImport/.parsed-products.json', 'utf8'));
  console.log(`Importing ${products.length} products...`);

  const created = [];
  const failed = [];

  for (const p of products) {
    try {
      const record = await productRepo.create({
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        sport: p.sport,
        gender: p.gender,
        team: p.team,
        league: p.league,
        images: p.images,
        active: true,
        sizes: [], // this data models one fixed color per product — see colors below
        colors: [
          {
            color: p.color,
            sizes: p.sizes,
          },
        ],
      });
      created.push({ row: p.sourceRow, id: record._id, name: p.name });
      process.stdout.write('.');
    } catch (error) {
      failed.push({ row: p.sourceRow, name: p.name, message: error.message });
      process.stdout.write('x');
    }
  }

  console.log(`\n\nCreated: ${created.length}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(`  Row ${f.row} (${f.name}): ${f.message}`));
  }

  const totalProducts = await prisma.product.count();
  const totalStockAgg = await prisma.product.aggregate({ _sum: { totalStock: true } });
  console.log(`\nFinal product count in database: ${totalProducts}`);
  console.log(`Total stock across all products: ${totalStockAgg._sum.totalStock}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
