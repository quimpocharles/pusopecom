import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const DEFAULT_INCLUDE = { sections: { include: { seats: true } } };

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

/**
 * Structural children get replaced wholesale on edit, same convention
 * promoCodeRepository.setProducts already established for a join/child set
 * that's simpler to fully regenerate than to diff — deleting a section
 * cascades to its Seats (onDelete: Cascade), so this alone is enough to
 * clear a section's prior seat layout before regenerating it.
 */
export async function deleteSection(id, { client = prisma } = {}) {
  await client.venueSection.delete({ where: { id } });
}

// --- Seat (grid-based MVP builder — see ADR-011) ---

/**
 * Lays out a regular rows x seatsPerRow grid for a RESERVED_SEAT section —
 * the deliberately-simple MVP seat-map builder (freeform layout matching a
 * real venue photo is a later enhancement, not this pass). Rows are
 * labeled A, B, C... (wrapping to AA, AB... past Z, though no real PH venue
 * section is expected to need that many rows); seat numbers are 1-indexed.
 * Replaces any existing seats for the section first — same
 * replace-wholesale convention as deleteSection/setProducts.
 */
export async function generateSeatGrid(venueSectionId, { rows, seatsPerRow }, { client = prisma } = {}) {
  await client.seat.deleteMany({ where: { venueSectionId } });

  const seats = [];
  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLetter(r);
    for (let n = 1; n <= seatsPerRow; n++) {
      seats.push({
        venueSectionId,
        row: rowLabel,
        seatNumber: String(n),
        label: `Row ${rowLabel}, Seat ${n}`,
      });
    }
  }

  await client.seat.createMany({ data: seats });
  await client.venueSection.update({ where: { id: venueSectionId }, data: { rows, seatsPerRow } });

  return findSeatsBySection(venueSectionId, { client });
}

function rowLetter(index) {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export async function findSeatsBySection(venueSectionId, { client = prisma } = {}) {
  const seats = await client.seat.findMany({ where: { venueSectionId }, orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }] });
  return serialize(seats);
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
  generateSeatGrid,
  findSeatsBySection,
};
