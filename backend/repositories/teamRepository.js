import prisma from '../lib/prisma.js';
import { generateSlug } from '../lib/slug.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { organization: 'organizationId' };
const withOrgFallback = (team) => (team ? withRelationFallback(team, RELATION_MAP) : team);

export async function findById(id, { include, client = prisma } = {}) {
  const team = await client.team.findUnique({ where: { id }, include });
  return withOrgFallback(serialize(team));
}

/** Team.slug is unique per Organization, not globally — always look up by the pair. */
export async function findBySlug({ organizationId, slug }, { include, client = prisma } = {}) {
  const team = await client.team.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
    include,
  });
  return withOrgFallback(serialize(team));
}

export async function findByOrganization(organizationId, { where, orderBy, client = prisma } = {}) {
  const teams = await client.team.findMany({ where: { organizationId, ...where }, orderBy });
  return serialize(teams).map(withOrgFallback);
}

export async function find({ where, orderBy, skip, take, include, client = prisma } = {}) {
  const teams = await client.team.findMany({ where, orderBy, skip, take, include });
  return serialize(teams).map(withOrgFallback);
}

export async function count({ where, client = prisma } = {}) {
  return client.team.count({ where });
}

export async function create({ slug, name, ...data }, { client = prisma } = {}) {
  const team = await client.team.create({
    data: { ...data, name, slug: slug || generateSlug(name) },
  });
  return withOrgFallback(serialize(team));
}

export async function updateById(id, data, { client = prisma } = {}) {
  const team = await client.team.update({ where: { id }, data });
  return withOrgFallback(serialize(team));
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.team.delete({ where: { id } });
}

export default {
  findById,
  findBySlug,
  findByOrganization,
  find,
  count,
  create,
  updateById,
  deleteById,
};
