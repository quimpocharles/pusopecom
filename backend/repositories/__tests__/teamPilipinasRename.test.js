import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../../lib/prisma.js';
import * as productRepo from '../productRepository.js';

const ROLLBACK = Symbol('rollback');

async function withRollback(testFn) {
  try {
    await prisma.$transaction(async (tx) => {
      await testFn(tx);
      throw ROLLBACK;
    }, { timeout: 20000 });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

afterAll(async () => { await prisma.$disconnect(); });

// Replicates the exact UPDATE statements from
// prisma/migrations/20260822120000_rename_national_team_to_team_pilipinas,
// so the test proves the migration's logic against a real "pre-rename" state
// without touching dev/production. A via-test-DB transaction is used so the
// fixture rolls back and leaves the isolated database unchanged.
async function applyRename(tx) {
  await tx.$executeRawUnsafe(`UPDATE "leagues" SET "name"='Team Pilipinas' WHERE "name"='National Team'`);
  await tx.$executeRawUnsafe(`UPDATE "products" SET "league"='Team Pilipinas' WHERE "league"='National Team'`);
  await tx.$executeRawUnsafe(`UPDATE "products" SET "team"='Team Pilipinas' WHERE "team"='National Team'`);
  await tx.$executeRawUnsafe(`UPDATE "organizations" SET "name"='Team Pilipinas' WHERE "name"='National Team' AND "kind"='league'`);
  await tx.$executeRawUnsafe(`UPDATE "navigation_links" SET "label"='Team Pilipinas' WHERE "label"='National Team'`);
  await tx.$executeRawUnsafe(`UPDATE "featured_teams" SET "team"='Team Pilipinas', "headline"='Team Pilipinas' WHERE "team"='National Team'`);
}

describe('Team Pilipinas rename migration — atomic and filter-preserving', () => {
  it('renames every confirmed National Team occurrence and keeps ?league=&?team= filtering working', () =>
    withRollback(async (tx) => {
      const suffix = Date.now() + '-' + Math.random().toString(36).slice(2);

      const league = await tx.league.create({ data: { name: 'National Team', sports: ['basketball'], active: true } });
      const product = await productRepo.create(
        {
          name: `Team Pilipinas Jersey ${suffix}`,
          slug: `team-pilipinas-jersey-${suffix}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: ['https://res.cloudinary.com/x.jpg'],
          league: 'National Team',
          team: 'National Team',
          sizes: [{ size: 'M', stock: 5 }],
        },
        { client: tx }
      );
      const navLink = await tx.navigationLink.create({ data: { label: 'National Team', destination: '/products?league=National%20Team', displayOrder: 0 } });

      // Pre-check: the old value is present, and the new league filter finds nothing yet.
      expect(await tx.league.count({ where: { name: 'National Team' } })).toBe(1);
      const preRenameLeagueFilter = await productRepo.find({ where: { league: 'Team Pilipinas', active: true }, client: tx });
      expect(preRenameLeagueFilter.find((p) => p._id === product._id)).toBeUndefined();

      await applyRename(tx);

      // 1. No relevant old-label records remain across the affected fields.
      expect(await tx.league.count({ where: { name: 'National Team' } })).toBe(0);
      expect(await tx.product.count({ where: { league: 'National Team' } })).toBe(0);
      expect(await tx.product.count({ where: { team: 'National Team' } })).toBe(0);
      expect(await tx.navigationLink.count({ where: { label: 'National Team' } })).toBe(0);

      // 2. Team Pilipinas now exists.
      expect(await tx.league.count({ where: { name: 'Team Pilipinas' } })).toBe(1);
      expect(await tx.navigationLink.count({ where: { label: 'Team Pilipinas' } })).toBe(1);
      expect(await tx.product.count({ where: { league: 'Team Pilipinas' } })).toBe(1);

      // 3. /products?league=Team%20Pilipinas continues to return the previously
      //    associated products (case-insensitive equals, same as the filter).
      const renamedProduct = await productRepo.find({ where: { league: 'Team Pilipinas', active: true }, client: tx });
      expect(renamedProduct.some((p) => p._id === product._id)).toBe(true);

      // 4. Existing team filtering remains intact (the free-text team was also
      //    renamed, so the ?team= filter still matches the same product).
      const byTeam = await productRepo.find({ where: { team: 'Team Pilipinas', active: true }, client: tx });
      expect(byTeam.some((p) => p._id === product._id)).toBe(true);

      // 5. The old league filter no longer matches (value renamed everywhere).
      const oldLeague = await productRepo.find({ where: { league: 'National Team', active: true }, client: tx });
      expect(oldLeague.some((p) => p._id === product._id)).toBe(false);

      // Cleanup hygiene scoped to this fixture (rolls back anyway).
      await tx.navigationLink.delete({ where: { id: navLink.id } });
      await tx.product.update({ where: { id: product._id }, data: { sizes: { deleteMany: {} } } });
    })
  , 20000);
});
