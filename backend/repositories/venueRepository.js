import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const DEFAULT_INCLUDE = { sections: true };

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const venue = await client.venue.findUnique({ where: { id }, include });
  return serialize(venue);
}

export async function findBySlug(slug, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const venue = await client.venue.findUnique({ where: { slug }, include });
  return serialize(venue);
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const venues = await client.venue.findMany({ where, orderBy, skip, take, include });
  return serialize(venues);
}

export async function count({ where, client = prisma } = {}) {
  return client.venue.count({ where });
}

export async function create(data, { client = prisma } = {}) {
  const venue = await client.venue.create({ data });
  return serialize(venue);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const venue = await client.venue.update({ where: { id }, data });
  return serialize(venue);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.venue.update({ where: { id }, data: { active: false } });
}

// --- VenueSection ---

export async function createSection(data, { client = prisma } = {}) {
  const section = await client.venueSection.create({ data });
  return serialize(section);
}

export async function updateSection(id, data, { client = prisma } = {}) {
  const section = await client.venueSection.update({ where: { id }, data });
  return serialize(section);
}

export async function deleteSection(id, { client = prisma } = {}) {
  await client.venueSection.delete({ where: { id } });
}

export default {
  findById,
  findBySlug,
  find,
  count,
  create,
  updateById,
  deleteById,
  createSection,
  updateSection,
  deleteSection,
};
