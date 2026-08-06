import * as orderRepository from '../../repositories/orderRepository.js';
import * as productRepository from '../../repositories/productRepository.js';
import * as organizationRepository from '../../repositories/organizationRepository.js';
import * as teamRepository from '../../repositories/teamRepository.js';
import * as followRepository from '../../repositories/followRepository.js';
import * as tryOnLogRepository from '../../repositories/tryOnLogRepository.js';
import { getDateFilter, groupBy } from '../../lib/reportQueryHelpers.js';

const TOP_N = 10;

/**
 * Queries exclusively the new Organization/Team FK model
 * (Product.organizationId/teamId), never the legacy league/team text
 * fields every other report in this file still uses — a deliberate choice
 * confirmed directly with the user: this is the Organization-first
 * migration's own report, so it should be correct from day one and show
 * real migration progress, not paper over the gap by falling back to the
 * flat strings CLAUDE.md says never to re-introduce as a structural floor.
 * Only ~16 products (one pilot org) have these fields populated today —
 * sparse results here are expected and itself informative, not a bug.
 */
export async function computeOrganizationsReport(query) {
  const dateFilter = getDateFilter(query);

  const paidOrders = await orderRepository.find({
    where: { paymentStatus: 'paid', ...dateFilter },
    include: { items: { include: { product: true } } },
  });
  const allItems = paidOrders.flatMap((o) => o.items);

  // Revenue by organization + Merchandise Sold (units) — same item shape,
  // one pass.
  const orgItems = allItems.filter((i) => i.product?.organizationId);
  const orgGroups = [...groupBy(orgItems, (i) => i.product.organizationId)];
  const orgIds = orgGroups.map(([id]) => id);
  const orgs = orgIds.length ? await organizationRepository.find({ where: { id: { in: orgIds } } }) : [];
  const orgById = new Map(orgs.map((o) => [o._id, o]));

  const revenueByOrganization = orgGroups
    .map(([id, items]) => ({
      organizationId: id,
      name: orgById.get(id)?.name ?? 'Unknown Organization',
      kind: orgById.get(id)?.kind ?? null,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topInstitutions = revenueByOrganization.filter((o) => o.kind === 'institution').slice(0, TOP_N);

  // Top Leagues — a real rollup, not a direct grouping: leagues (kind =
  // 'league', e.g. UAAP) don't own Products, member institutions
  // (schools/clubs) do. A member's revenue attributes up to every league
  // it participates in via OrganizationParticipation — a ranking view, not
  // a summable total, since a school in multiple leagues counts toward
  // each one.
  const participations = await organizationRepository.findParticipationsForMembers(orgIds);
  const leagueAgg = new Map();
  for (const p of participations) {
    if (p.inOrganization?.kind !== 'league') continue;
    const memberRevenue = revenueByOrganization.find((o) => o.organizationId === p.memberOrganizationId);
    if (!memberRevenue) continue;
    const existing = leagueAgg.get(p.inOrganizationId) ?? {
      organizationId: p.inOrganizationId,
      name: p.inOrganization.name,
      revenue: 0,
      units: 0,
    };
    existing.revenue += memberRevenue.revenue;
    existing.units += memberRevenue.units;
    leagueAgg.set(p.inOrganizationId, existing);
  }
  const topLeagues = [...leagueAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, TOP_N);

  // Top Teams — via the new Team FK, not the legacy Product.team string
  // computeProductsReport's salesByTeam already groups by.
  const teamItems = allItems.filter((i) => i.product?.teamId);
  const teamGroups = [...groupBy(teamItems, (i) => i.product.teamId)];
  const teamIds = teamGroups.map(([id]) => id);
  const teams = teamIds.length
    ? await teamRepository.find({ where: { id: { in: teamIds } }, include: { organization: true } })
    : [];
  const teamById = new Map(teams.map((t) => [t._id, t]));
  const topTeams = teamGroups
    .map(([id, items]) => ({
      teamId: id,
      name: teamById.get(id)?.name ?? 'Unknown Team',
      organizationName: teamById.get(id)?.organization?.name ?? null,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_N);

  // Followers — a standalone ranking across every active organization, not
  // scoped to whichever orgs happened to have paid revenue in range. An
  // organization can have real fan traction with zero sales.
  const allActiveOrgs = await organizationRepository.find({ where: { active: true } });
  const followerCounts = await followRepository.followerCountsByOrganization(allActiveOrgs.map((o) => o._id));
  const topFollowed = allActiveOrgs
    .map((o) => ({ organizationId: o._id, name: o.name, kind: o.kind, followers: followerCounts.get(o._id) ?? 0 }))
    .filter((o) => o.followers > 0)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, TOP_N);

  // Fit Check engagement — Fit Checks tried on each organization's own
  // products (parallels Merchandise Sold's shape exactly), not sponsored-
  // campaign performance — confirmed with the user as the primary reading.
  const tryOnLogs = await tryOnLogRepository.find({
    where: { ...dateFilter, productId: { not: null } },
    include: { product: { select: { organizationId: true } } },
  });
  const orgTryOnLogs = tryOnLogs.filter((l) => l.product?.organizationId);
  const fitCheckEngagement = [...groupBy(orgTryOnLogs, (l) => l.product.organizationId)]
    .map(([id, logs]) => ({
      organizationId: id,
      name: orgById.get(id)?.name ?? allActiveOrgs.find((o) => o._id === id)?.name ?? 'Unknown Organization',
      attempts: logs.length,
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, TOP_N);

  // Migration-progress indicator — sparse Organization-model data is
  // expected right now; showing this directly (rather than a near-empty
  // report with no explanation) is itself useful operational visibility.
  const [migratedProductCount, totalProductCount] = await Promise.all([
    productRepository.count({ where: { active: true, organizationId: { not: null } } }),
    productRepository.count({ where: { active: true } }),
  ]);

  return {
    revenueByOrganization,
    topInstitutions,
    topLeagues,
    topTeams,
    topFollowed,
    fitCheckEngagement,
    migration: { migratedProductCount, totalProductCount },
  };
}

export function organizationsReportToExportShape(data) {
  return {
    summary: [
      ['Products Migrated to Organization Model', `${data.migration.migratedProductCount} of ${data.migration.totalProductCount}`],
    ],
    sheets: [
      {
        name: 'Revenue by Organization',
        columns: [{ header: 'Organization', key: 'name' }, { header: 'Kind', key: 'kind' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.revenueByOrganization,
        totals: { revenue: true, units: true },
      },
      {
        name: 'Top Institutions',
        columns: [{ header: 'Institution', key: 'name' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.topInstitutions,
        totals: { revenue: true, units: true },
      },
      {
        name: 'Top Leagues',
        columns: [{ header: 'League', key: 'name' }, { header: 'Member Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.topLeagues,
      },
      {
        name: 'Top Teams',
        columns: [{ header: 'Team', key: 'name' }, { header: 'Organization', key: 'organizationName' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.topTeams,
        totals: { revenue: true, units: true },
      },
      {
        name: 'Top Followed',
        columns: [{ header: 'Organization', key: 'name' }, { header: 'Followers', key: 'followers' }],
        rows: data.topFollowed,
      },
      {
        name: 'Fit Check Engagement',
        columns: [{ header: 'Organization', key: 'name' }, { header: 'Fit Check Attempts', key: 'attempts' }],
        rows: data.fitCheckEngagement,
        totals: { attempts: true },
      },
    ],
  };
}
