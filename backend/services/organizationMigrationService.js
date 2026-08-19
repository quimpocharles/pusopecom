import prisma from '../lib/prisma.js';
import * as organizationRepository from '../repositories/organizationRepository.js';
import * as teamRepository from '../repositories/teamRepository.js';

/**
 * The single-pilot Organization-first migration (ADR-001/002). Mirrors the
 * pure-plan / thin-apply split already proven by scripts/uaapImport/
 * (parse.js is pure, run.js is the thin I/O wrapper) — planPilotMigration
 * takes no DB connection and is fully unit-testable against a fixture;
 * applyPilotMigration is the one function that writes.
 *
 * Far Eastern University is the pilot: real production data (16 products,
 * the most of any UAAP school), spans two sports under one Organization
 * (proves ADR-002's multi-team ownership), has both org-level products
 * (no team) and team-scoped ones. See the plan this shipped under for the
 * full reasoning.
 */

export const FEU_PILOT_MANIFEST = {
  institution: { name: 'Far Eastern University', shortName: 'FEU', kind: 'institution' },
  league: { name: 'UAAP', kind: 'league', existingLeagueName: 'UAAP' },
  teams: [
    { ref: 'basketball', name: 'FEU Tamaraws', sport: 'basketball' },
    { ref: 'volleyball', name: 'FEU Lady Tamaraws', sport: 'volleyball' },
  ],
  // The one inference this pilot makes that isn't stated anywhere in the
  // source data: UAAP volleyball merchandise is predominantly the women's
  // program, but nothing in the real product rows says so. Set to false to
  // leave volleyball products' teamId unset (organizationId still gets
  // backfilled either way) rather than assume.
  assignVolleyballToLadyTamaraws: true,
};

/**
 * Pure — no DB, no I/O. Takes the manifest and the pilot's real Product
 * rows ({ id, name, sport } is all that's read) and returns a plan
 * describing every row this migration would create or update, plus any
 * inference that needs human sign-off before applyPilotMigration runs.
 */
export function planPilotMigration(manifest, products) {
  const organizationsToCreate = [
    { ref: 'institution', name: manifest.institution.name, shortName: manifest.institution.shortName, kind: manifest.institution.kind },
    { ref: 'league', name: manifest.league.name, kind: manifest.league.kind },
  ];

  const teamsToCreate = manifest.teams.map((t) => ({
    ref: `team-${t.ref}`,
    organizationRef: 'institution',
    name: t.name,
    sport: t.sport,
  }));

  const participationsToCreate = [
    { memberOrganizationRef: 'institution', inOrganizationRef: 'league' },
  ];

  const leagueBridges = [
    { existingLeagueName: manifest.league.existingLeagueName, organizationRef: 'league' },
  ];

  const inferences = [];
  const warnings = [];

  const teamRefBySport = { basketball: 'team-basketball', volleyball: 'team-volleyball' };

  const productUpdates = products.map((p) => {
    let teamRef = null;
    if (p.sport === 'basketball') {
      teamRef = teamRefBySport.basketball;
    } else if (p.sport === 'volleyball') {
      if (manifest.assignVolleyballToLadyTamaraws) {
        teamRef = teamRefBySport.volleyball;
        inferences.push({
          productId: p.id,
          productName: p.name,
          inference: `Assigned to "FEU Lady Tamaraws" (women's volleyball) — the source data only says sport=volleyball, not which squad. Set manifest.assignVolleyballToLadyTamaraws=false to leave this product's teamId unset instead.`,
        });
      }
      // else: organizationId still gets backfilled below, teamId stays null
    } else if (p.sport !== 'general') {
      warnings.push({ productId: p.id, productName: p.name, warning: `Unexpected sport "${p.sport}" — organizationId will be backfilled, teamId left unset.` });
    }

    return { productId: p.id, organizationRef: 'institution', teamRef };
  });

  return { organizationsToCreate, teamsToCreate, participationsToCreate, leagueBridges, productUpdates, inferences, warnings };
}

/**
 * Executes a plan from planPilotMigration inside one transaction (unless a
 * client is already given, matching the composability convention used
 * throughout repositories/*.js). All-or-nothing: any failure rolls back
 * every organization, team, participation, league bridge, and product
 * update together, not partially.
 */
export async function applyPilotMigration(plan, { client } = {}) {
  const run = async (tx) => {
    const idByRef = new Map();

    for (const org of plan.organizationsToCreate) {
      const created = await organizationRepository.create(
        { name: org.name, shortName: org.shortName, kind: org.kind },
        { client: tx }
      );
      idByRef.set(org.ref, created._id);
    }

    for (const team of plan.teamsToCreate) {
      const created = await teamRepository.create(
        { organizationId: idByRef.get(team.organizationRef), name: team.name, sport: team.sport },
        { client: tx }
      );
      idByRef.set(team.ref, created._id);
    }

    for (const p of plan.participationsToCreate) {
      await tx.organizationParticipation.create({
        data: { memberOrganizationId: idByRef.get(p.memberOrganizationRef), inOrganizationId: idByRef.get(p.inOrganizationRef) },
      });
    }

    for (const bridge of plan.leagueBridges) {
      await tx.league.update({
        where: { name: bridge.existingLeagueName },
        data: { organizationId: idByRef.get(bridge.organizationRef) },
      });
    }

    for (const update of plan.productUpdates) {
      await tx.product.update({
        where: { id: update.productId },
        data: { organizationId: idByRef.get(update.organizationRef), teamId: update.teamRef ? idByRef.get(update.teamRef) : null },
      });
    }

    return {
      organizationIds: plan.organizationsToCreate.map((o) => idByRef.get(o.ref)),
      teamIds: plan.teamsToCreate.map((t) => idByRef.get(t.ref)),
      productsUpdated: plan.productUpdates.length,
    };
  };

  return client ? run(client) : prisma.$transaction(run, { timeout: 15000 });
}

/**
 * The rollback path, written and tested before applyPilotMigration is ever
 * run for real (see the plan's Step 4/6 sequencing). Explicit slugs, not
 * inferred from participation edges — a future second pilot must not have
 * its league accidentally unwound by this function.
 */
export async function revertPilotMigration({ institutionSlug, leagueSlug }, { client } = {}) {
  const run = async (tx) => {
    const institution = await tx.organization.findUnique({ where: { slug: institutionSlug } });
    const league = await tx.organization.findUnique({ where: { slug: leagueSlug } });
    if (!institution) return { reverted: false, reason: 'institution not found' };

    await tx.product.updateMany({
      where: { organizationId: institution.id },
      data: { organizationId: null, teamId: null },
    });
    if (league) {
      await tx.league.updateMany({ where: { organizationId: league.id }, data: { organizationId: null } });
    }
    await tx.organizationParticipation.deleteMany({ where: { memberOrganizationId: institution.id } });
    await tx.team.deleteMany({ where: { organizationId: institution.id } });
    await tx.organization.delete({ where: { id: institution.id } });
    if (league) {
      await tx.organization.delete({ where: { id: league.id } });
    }

    return { reverted: true, institutionId: institution.id, leagueId: league?.id ?? null };
  };

  return client ? run(client) : prisma.$transaction(run, { timeout: 15000 });
}

/**
 * The generic, self-service form of the League->Organization bridge the
 * pilot script above only ever ran once, by hand, for UAAP. PassEvent needs
 * every League selectable without re-entering the same league data as a
 * second, separately-managed Organization — this just ensures a same-named
 * Organization exists for a given League (creating it on first use) and
 * returns its id, reusing League.organizationId as the idempotency check
 * exactly the way the pilot's own leagueBridges step does. Deliberately
 * skips the pilot's Team/Product backfill entirely — Pass Events don't need
 * a league's historical roster, just a real Organization to anchor to.
 */
export async function ensureLeagueOrganization(leagueId, { client } = {}) {
  const run = async (tx) => {
    const league = await tx.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new Error(`League ${leagueId} not found`);
    if (league.organizationId) return league.organizationId;

    const org = await organizationRepository.create({ name: league.name, kind: 'league' }, { client: tx });
    await tx.league.update({ where: { id: leagueId }, data: { organizationId: org._id } });
    return org._id;
  };

  return client ? run(client) : prisma.$transaction(run);
}

export default { FEU_PILOT_MANIFEST, planPilotMigration, applyPilotMigration, revertPilotMigration, ensureLeagueOrganization };
