import { describe, it, expect } from 'vitest';
import { planPilotMigration, FEU_PILOT_MANIFEST } from '../organizationMigrationService.js';
import feuProducts from './fixtures/feu-products.json' with { type: 'json' };

// Pure function — no DB, no I/O. Tested against the real 16 FEU products
// (13 general, 1 basketball, 2 volleyball), captured live from Railway
// before this migration ran, not synthetic data.
describe('planPilotMigration', () => {
  it('plans two Organizations (institution + league) and two Teams', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);

    expect(plan.organizationsToCreate).toEqual([
      { ref: 'institution', name: 'Far Eastern University', shortName: 'FEU', kind: 'institution' },
      { ref: 'league', name: 'UAAP', kind: 'league' },
    ]);
    expect(plan.teamsToCreate).toEqual([
      { ref: 'team-basketball', organizationRef: 'institution', name: 'FEU Tamaraws', sport: 'basketball' },
      { ref: 'team-volleyball', organizationRef: 'institution', name: 'FEU Lady Tamaraws', sport: 'volleyball' },
    ]);
  });

  it('plans exactly one participation edge: FEU participates in UAAP, not the reverse', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    expect(plan.participationsToCreate).toEqual([
      { memberOrganizationRef: 'institution', inOrganizationRef: 'league' },
    ]);
  });

  it('bridges the existing UAAP League row to the new league Organization', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    expect(plan.leagueBridges).toEqual([{ existingLeagueName: 'UAAP', organizationRef: 'league' }]);
  });

  it('scopes every one of the 16 real FEU products to the institution Organization', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    expect(plan.productUpdates).toHaveLength(16);
    expect(plan.productUpdates.every((u) => u.organizationRef === 'institution')).toBe(true);
    expect(plan.productUpdates.map((u) => u.productId).sort()).toEqual(feuProducts.map((p) => p.id).sort());
  });

  it('assigns the 1 basketball product to the basketball Team, the 13 general products to no Team', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    const byProductId = new Map(plan.productUpdates.map((u) => [u.productId, u]));

    const basketballProduct = feuProducts.find((p) => p.sport === 'basketball');
    expect(byProductId.get(basketballProduct.id).teamRef).toBe('team-basketball');

    const generalProducts = feuProducts.filter((p) => p.sport === 'general');
    expect(generalProducts).toHaveLength(13);
    for (const p of generalProducts) {
      expect(byProductId.get(p.id).teamRef).toBeNull();
    }
  });

  it('flags the volleyball -> Lady Tamaraws assignment as an inference requiring sign-off, for both real volleyball products', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    const volleyballProducts = feuProducts.filter((p) => p.sport === 'volleyball');
    expect(volleyballProducts).toHaveLength(2);

    const byProductId = new Map(plan.productUpdates.map((u) => [u.productId, u]));
    for (const p of volleyballProducts) {
      expect(byProductId.get(p.id).teamRef).toBe('team-volleyball');
    }

    expect(plan.inferences).toHaveLength(2);
    expect(plan.inferences.map((i) => i.productId).sort()).toEqual(volleyballProducts.map((p) => p.id).sort());
    expect(plan.inferences[0].inference).toMatch(/Lady Tamaraws/);
  });

  it('leaves volleyball teamId unset (no inference) when assignVolleyballToLadyTamaraws is false, but organizationId is still backfilled', () => {
    const manifest = { ...FEU_PILOT_MANIFEST, assignVolleyballToLadyTamaraws: false };
    const plan = planPilotMigration(manifest, feuProducts);

    const volleyballProducts = feuProducts.filter((p) => p.sport === 'volleyball');
    const byProductId = new Map(plan.productUpdates.map((u) => [u.productId, u]));
    for (const p of volleyballProducts) {
      expect(byProductId.get(p.id).teamRef).toBeNull();
      expect(byProductId.get(p.id).organizationRef).toBe('institution'); // still scoped to the Organization
    }
    expect(plan.inferences).toHaveLength(0);
  });

  it('produces no warnings for real, well-formed FEU data', () => {
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    expect(plan.warnings).toEqual([]);
  });

  it('warns (does not throw) on an unexpected sport value, still backfilling organizationId', () => {
    const withOddProduct = [...feuProducts, { id: 'fake-id-1', name: 'FEU Odd Product', sport: 'football' }];
    const plan = planPilotMigration(FEU_PILOT_MANIFEST, withOddProduct);

    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].productId).toBe('fake-id-1');

    const oddUpdate = plan.productUpdates.find((u) => u.productId === 'fake-id-1');
    expect(oddUpdate.organizationRef).toBe('institution');
    expect(oddUpdate.teamRef).toBeNull();
  });

  it('is pure — calling it twice with the same input produces identical output', () => {
    const planA = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    const planB = planPilotMigration(FEU_PILOT_MANIFEST, feuProducts);
    expect(planA).toEqual(planB);
  });
});
