import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const DEFAULT_INCLUDE = { slots: true };

/** Same soft-singleton convention as SiteSettings — find the first row, or null if none exists yet. */
export async function get({ client = prisma } = {}) {
  const config = await client.venuePickupConfig.findFirst({ include: DEFAULT_INCLUDE });
  return serialize(config);
}

/**
 * Replaces slots[] wholesale on update (delete-then-recreate) rather than
 * diffing — matches how the Mongoose version behaved in practice, since
 * `VenuePickupConfig.findOneAndUpdate` with a full `slots` array replaces
 * the whole embedded array rather than merging it. `updatedAt` is no
 * longer set manually here — Prisma's `@updatedAt` does it automatically,
 * same behavior as the old pre('save') hook, less code.
 */
export async function upsert({ slots, ...data }, { client = prisma } = {}) {
  const existing = await client.venuePickupConfig.findFirst();

  if (!existing) {
    return serialize(
      await client.venuePickupConfig.create({
        data: { ...data, slots: { create: slots ?? [] } },
        include: DEFAULT_INCLUDE,
      })
    );
  }

  const [, , updated] = await client.$transaction([
    client.pickupSlot.deleteMany({ where: { configId: existing.id } }),
    client.venuePickupConfig.update({ where: { id: existing.id }, data }),
    client.venuePickupConfig.update({
      where: { id: existing.id },
      data: { slots: { create: slots ?? [] } },
      include: DEFAULT_INCLUDE,
    }),
  ]);

  return serialize(updated);
}

export default { get, upsert };
