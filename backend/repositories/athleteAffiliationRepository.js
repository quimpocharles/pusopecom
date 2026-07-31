import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { athleteOrganization: 'athleteOrganizationId', organization: 'organizationId', team: 'teamId' };
const withFallbacks = (row) => (row ? withRelationFallback(row, RELATION_MAP) : row);

export async function findById(id, { include, client = prisma } = {}) {
  const row = await client.athleteAffiliation.findUnique({ where: { id }, include });
  return withFallbacks(serialize(row));
}

export async function findByAthlete(athleteOrganizationId, { include, client = prisma } = {}) {
  const rows = await client.athleteAffiliation.findMany({ where: { athleteOrganizationId }, include });
  return serialize(rows).map(withFallbacks);
}

export async function findByOrganization(organizationId, { include, client = prisma } = {}) {
  const rows = await client.athleteAffiliation.findMany({ where: { organizationId }, include });
  return serialize(rows).map(withFallbacks);
}

export async function findByTeam(teamId, { include, client = prisma } = {}) {
  const rows = await client.athleteAffiliation.findMany({ where: { teamId }, include });
  return serialize(rows).map(withFallbacks);
}

export async function create({ athleteOrganizationId, organizationId, teamId, startDate }, { client = prisma } = {}) {
  const row = await client.athleteAffiliation.create({
    data: { athleteOrganizationId, organizationId, teamId: teamId ?? null, startDate: startDate ?? new Date() },
  });
  return withFallbacks(serialize(row));
}

/** Ends an affiliation — a transfer, retirement, or new call-up (docs/DOMAIN_MODEL.md), never a delete: history stays intact. */
export async function endById(id, endDate = new Date(), { client = prisma } = {}) {
  const row = await client.athleteAffiliation.update({ where: { id }, data: { endDate } });
  return withFallbacks(serialize(row));
}

export default { findById, findByAthlete, findByOrganization, findByTeam, create, endById };
