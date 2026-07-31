import 'dotenv/config';
import prisma from '../../lib/prisma.js';
import * as productRepository from '../../repositories/productRepository.js';
import { generateSlug } from '../../lib/slug.js';
import {
  FEU_PILOT_MANIFEST,
  planPilotMigration,
  applyPilotMigration,
  revertPilotMigration,
} from '../../services/organizationMigrationService.js';

/**
 * The single-pilot Organization-first backfill (Far Eastern University).
 * Dry-run by default — prints the full plan and writes nothing. Real
 * writes require an explicit flag:
 *
 *   node scripts/organizationPilot/run.js              # dry run (default)
 *   node scripts/organizationPilot/run.js --apply       # writes for real
 *   node scripts/organizationPilot/run.js --rollback    # reverts the pilot
 *
 * Mirrors scripts/uaapImport/'s split: this file is the thin I/O wrapper;
 * all the actual planning logic lives in organizationMigrationService.js
 * (pure) and is unit-tested there, not here.
 */
async function printPlan(plan, products) {
  const slugById = new Map(products.map((p) => [p._id, p.slug]));

  console.log('=== Organizations to create ===');
  for (const org of plan.organizationsToCreate) {
    console.log(`  [${org.ref}] ${org.name} (kind: ${org.kind}, slug: ${generateSlug(org.name)})`);
  }

  console.log('\n=== Teams to create ===');
  for (const team of plan.teamsToCreate) {
    console.log(`  [${team.ref}] ${team.name} — sport: ${team.sport}, org: ${team.organizationRef}`);
  }

  console.log('\n=== Participation edges ===');
  for (const p of plan.participationsToCreate) {
    console.log(`  ${p.memberOrganizationRef} participates in ${p.inOrganizationRef}`);
  }

  console.log('\n=== League bridges ===');
  for (const b of plan.leagueBridges) {
    console.log(`  League "${b.existingLeagueName}" -> Organization [${b.organizationRef}]`);
  }

  console.log(`\n=== Product updates (${plan.productUpdates.length}) ===`);
  for (const u of plan.productUpdates) {
    const slug = slugById.get(u.productId) ?? u.productId;
    console.log(`  ${slug} -> organization: ${u.organizationRef}, team: ${u.teamRef ?? '(none)'}`);
  }

  if (plan.inferences.length) {
    console.log(`\n=== Inferences requiring sign-off (${plan.inferences.length}) ===`);
    for (const i of plan.inferences) {
      console.log(`  ${i.productName}: ${i.inference}`);
    }
  }

  if (plan.warnings.length) {
    console.log(`\n=== Warnings (${plan.warnings.length}) ===`);
    for (const w of plan.warnings) {
      console.log(`  ${w.productName}: ${w.warning}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doRollback = args.includes('--rollback');

  if (doRollback) {
    const institutionSlug = generateSlug(FEU_PILOT_MANIFEST.institution.name);
    const leagueSlug = generateSlug(FEU_PILOT_MANIFEST.league.name);
    console.log(`Rolling back pilot Organizations "${institutionSlug}" and "${leagueSlug}"...`);
    const result = await revertPilotMigration({ institutionSlug, leagueSlug });
    console.log(result.reverted ? 'Reverted.' : `Nothing to revert: ${result.reason}`);
    await prisma.$disconnect();
    return;
  }

  const products = await productRepository.find({ where: { team: FEU_PILOT_MANIFEST.institution.name } });
  console.log(`Found ${products.length} real products for "${FEU_PILOT_MANIFEST.institution.name}".`);

  const plan = planPilotMigration(
    FEU_PILOT_MANIFEST,
    products.map((p) => ({ id: p._id, name: p.name, sport: p.sport }))
  );

  await printPlan(plan, products);

  if (!doApply) {
    console.log('\nDry run only — nothing was written. Re-run with --apply to write these changes.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApplying...');
  const result = await applyPilotMigration(plan);
  console.log('Done.', result);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
