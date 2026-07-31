import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../../lib/prisma.js';
import { planPilotMigration, applyPilotMigration, revertPilotMigration, FEU_PILOT_MANIFEST } from '../organizationMigrationService.js';

/**
 * Proves apply + revert work end-to-end against the real schema before the
 * real backfill script (scripts/organizationPilot/run.js) ever runs for
 * real — the plan's own requirement: "revertPilotMigration, written and
 * tested before apply ever runs." Uses a synthetic manifest and synthetic
 * products (not the real FEU data or the real UAAP League row) so this
 * test never touches production identity data — everything it creates is
 * rolled back regardless, but there's no reason to even transiently
 * collide with the real pilot's names.
 */
const ROLLBACK = Symbol('intentional-rollback');
async function withRollback(testFn, { timeout } = {}) {
  try {
    await prisma.$transaction(async (tx) => {
      await testFn(tx);
      throw ROLLBACK;
    }, timeout ? { timeout } : undefined);
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});

function syntheticManifest(suffix) {
  return {
    institution: { name: `Test Institution ${suffix}`, shortName: 'TI', kind: 'institution' },
    league: { name: `Test League ${suffix}`, kind: 'league', existingLeagueName: `Test League Row ${suffix}` },
    teams: [
      { ref: 'basketball', name: `TI Ballers ${suffix}`, sport: 'basketball' },
      { ref: 'volleyball', name: `TI Spikers ${suffix}`, sport: 'volleyball' },
    ],
    assignVolleyballToLadyTamaraws: true,
  };
}

describe('applyPilotMigration + revertPilotMigration — end-to-end against the real schema', () => {
  it('applies the full plan atomically: 2 Organizations, 2 Teams, 1 participation, 1 league bridge, N product updates', () =>
    withRollback(async (tx) => {
      const suffix = Date.now();
      const manifest = syntheticManifest(suffix);

      const league = await tx.league.create({ data: { name: manifest.league.existingLeagueName, sports: ['basketball'] } });
      const p1 = await tx.product.create({ data: { name: `TI Jersey ${suffix}`, slug: `ti-jersey-${suffix}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [] } });
      const p2 = await tx.product.create({ data: { name: `TI Volley Jersey ${suffix}`, slug: `ti-volley-${suffix}`, description: 'x', price: 500, category: 'jersey', sport: 'volleyball', images: [] } });
      const p3 = await tx.product.create({ data: { name: `TI Cap ${suffix}`, slug: `ti-cap-${suffix}`, description: 'x', price: 200, category: 'cap', sport: 'general', images: [] } });

      const plan = planPilotMigration(manifest, [
        { id: p1.id, name: p1.name, sport: 'basketball' },
        { id: p2.id, name: p2.name, sport: 'volleyball' },
        { id: p3.id, name: p3.name, sport: 'general' },
      ]);

      const result = await applyPilotMigration(plan, { client: tx });
      expect(result.organizationIds).toHaveLength(2);
      expect(result.teamIds).toHaveLength(2);
      expect(result.productsUpdated).toBe(3);

      const institution = await tx.organization.findUnique({ where: { id: result.organizationIds[0] } });
      expect(institution.name).toBe(manifest.institution.name);
      expect(institution.verificationStatus).toBe('unverified'); // apply never grants trust

      const participations = await tx.organizationParticipation.findMany({ where: { memberOrganizationId: result.organizationIds[0] } });
      expect(participations).toHaveLength(1);
      expect(participations[0].inOrganizationId).toBe(result.organizationIds[1]);

      const bridgedLeague = await tx.league.findUnique({ where: { id: league.id } });
      expect(bridgedLeague.organizationId).toBe(result.organizationIds[1]);

      const updatedP1 = await tx.product.findUnique({ where: { id: p1.id } });
      expect(updatedP1.organizationId).toBe(result.organizationIds[0]);
      expect(updatedP1.teamId).toBe(result.teamIds[0]); // basketball

      const updatedP2 = await tx.product.findUnique({ where: { id: p2.id } });
      expect(updatedP2.teamId).toBe(result.teamIds[1]); // volleyball

      const updatedP3 = await tx.product.findUnique({ where: { id: p3.id } });
      expect(updatedP3.organizationId).toBe(result.organizationIds[0]);
      expect(updatedP3.teamId).toBeNull(); // general — no team
    }, { timeout: 15000 }), 15000);

  it('revertPilotMigration returns the database to exactly its pre-apply state', () =>
    withRollback(async (tx) => {
      const suffix = Date.now();
      const manifest = syntheticManifest(suffix);

      await tx.league.create({ data: { name: manifest.league.existingLeagueName, sports: ['basketball'] } });
      const product = await tx.product.create({ data: { name: `TI Product ${suffix}`, slug: `ti-product-${suffix}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [] } });

      const plan = planPilotMigration(manifest, [{ id: product.id, name: product.name, sport: 'basketball' }]);
      await applyPilotMigration(plan, { client: tx });

      const institutionSlug = (await tx.organization.findFirst({ where: { name: manifest.institution.name } })).slug;
      const leagueSlug = (await tx.organization.findFirst({ where: { name: manifest.league.name } })).slug;

      const revertResult = await revertPilotMigration({ institutionSlug, leagueSlug }, { client: tx });
      expect(revertResult.reverted).toBe(true);

      // every trace is gone
      expect(await tx.organization.findMany({ where: { OR: [{ slug: institutionSlug }, { slug: leagueSlug }] } })).toHaveLength(0);
      expect(await tx.team.findMany({ where: { organizationId: revertResult.institutionId } })).toHaveLength(0);
      expect(await tx.organizationParticipation.findMany({ where: { memberOrganizationId: revertResult.institutionId } })).toHaveLength(0);

      // the product survives, with both new FKs cleared — nothing about the product itself was touched
      const revertedProduct = await tx.product.findUnique({ where: { id: product.id } });
      expect(revertedProduct).not.toBeNull();
      expect(revertedProduct.organizationId).toBeNull();
      expect(revertedProduct.teamId).toBeNull();
      expect(revertedProduct.name).toBe(product.name); // untouched

      // the League row survives too, bridge cleared
      const revertedLeague = await tx.league.findUnique({ where: { name: manifest.league.existingLeagueName } });
      expect(revertedLeague).not.toBeNull();
      expect(revertedLeague.organizationId).toBeNull();
    }, { timeout: 15000 }), 15000);

  it('revertPilotMigration is a safe no-op when the institution was never created', () =>
    withRollback(async (tx) => {
      const result = await revertPilotMigration({ institutionSlug: 'no-such-institution', leagueSlug: 'no-such-league' }, { client: tx });
      expect(result.reverted).toBe(false);
    }));
});
