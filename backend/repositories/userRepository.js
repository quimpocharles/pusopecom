import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { canonicalEmail } from '../lib/email.js';

/**
 * Mongoose did three things invisibly here that Prisma has no built-in
 * equivalent for, and all three are reproduced explicitly below rather
 * than via Prisma middleware/extensions — per the Engineering Handbook's
 * preference for explicit application-layer logic over ORM magic for
 * anything business-critical:
 *
 *  1. `userSchema.pre('save')` hashed `password` automatically whenever it
 *     was set/changed. There is no "was this field modified" concept
 *     outside a Mongoose document's own change tracking, so the repository
 *     hashes whenever a `password` key is present in the input — that's
 *     the natural signal a caller wants to set a new password.
 *  2. `userSchema.methods.toJSON` stripped password/tokens/lockout fields
 *     whenever a User document was serialized to JSON — which happens
 *     implicitly at every `res.json()` call site today. Prisma has no
 *     serialization hook, so `sanitize()` below must be called explicitly.
 *     middleware/auth.js calls it once, on every authenticated request, so
 *     individual routes don't each need to remember to.
 *  3. `User.addresses` was an embedded array, always present on every
 *     fetch with no separate "populate" step ever needed. DEFAULT_INCLUDE
 *     below reproduces that — addresses come back by default on every
 *     read, matching how the field always behaved, not how a real
 *     relational join usually behaves.
 */

const SENSITIVE_FIELDS = [
  'password',
  'verificationToken',
  'resetPasswordToken',
  'resetPasswordExpires',
  'failedLoginAttempts',
  'accountLocked',
];

const SALT_ROUNDS = 10;
const DEFAULT_INCLUDE = { addresses: true };

async function hashIfPresent(data) {
  if (!data.password) return data;
  const hashed = await bcrypt.hash(data.password, await bcrypt.genSalt(SALT_ROUNDS));
  return { ...data, password: hashed };
}

/** Matches User.toJSON()'s exact field list — call before any API response. */
export function sanitize(user) {
  if (!user) return user;
  const result = { ...user };
  for (const field of SENSITIVE_FIELDS) delete result[field];
  return result;
}

/** Matches userSchema.methods.comparePassword exactly, including the no-password (social-auth) case. */
export async function comparePassword(user, candidatePassword) {
  if (!user?.password) return false;
  return bcrypt.compare(candidatePassword, user.password);
}

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findUnique({ where: { id }, include });
  return serialize(user);
}

export async function findByEmail(email, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findUnique({ where: { email: canonicalEmail(email) }, include });
  return serialize(user);
}

export async function findByGoogleId(googleId, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findUnique({ where: { googleId }, include });
  return serialize(user);
}

export async function findByFacebookId(facebookId, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findUnique({ where: { facebookId }, include });
  return serialize(user);
}

/** Matches the Google OAuth route's `User.findOne({ $or: [{ googleId }, { email }] })`. */
export async function findByGoogleIdOrEmail(googleId, email, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findFirst({
    where: { OR: [{ googleId }, { email: canonicalEmail(email) }] },
    include,
  });
  return serialize(user);
}

export async function findByVerificationToken(token, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findFirst({ where: { verificationToken: token }, include });
  return serialize(user);
}

export async function findByResetToken(token, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.findFirst({
    where: { resetPasswordToken: token, resetPasswordExpires: { gt: new Date() } },
    include,
  });
  return serialize(user);
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const users = await client.user.findMany({ where, orderBy, skip, take, include });
  return serialize(users);
}

export async function count({ where, client = prisma } = {}) {
  return client.user.count({ where });
}

export async function create(data, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.create({ data: await hashIfPresent(data), include });
  return serialize(user);
}

export async function updateById(id, data, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const user = await client.user.update({ where: { id }, data: await hashIfPresent(data), include });
  return serialize(user);
}

/**
 * Address CRUD — Mongoose modeled these as an embedded array with helper
 * methods (`.id()`, `.pull()`); Postgres has them as a real table with a
 * `userId` foreign key. The ownership check below is not an enhancement —
 * it's replacing something Mongoose gave for free by structure. In
 * Mongoose, `user.addresses.id(addressId)` could only ever find an address
 * already nested inside the specific user document you'd already fetched
 * by `req.user._id` — there was no way to reach another user's address by
 * accident. A real table has no such structural guarantee, so every
 * update/delete below filters explicitly by BOTH `id` and `userId` — this
 * is the same ownership-check discipline the Trust Model and the original
 * platform audit's Critical #2 finding both require, just implemented
 * here instead of assumed.
 */

// The Mongoose original was `user.addresses.push(...); await user.save()`
// — one atomic document write. Multiple separate Address-table statements
// need an explicit transaction to preserve that same atomicity. When no
// `client` is given (the real route call sites), these self-wrap in their
// own prisma.$transaction. Tests pass `{ client: tx }` from an outer
// withRollback transaction instead — same composability convention as the
// rest of this file, just applied to the transaction itself rather than a
// single statement.

// Mass-assignment guard: Address.create/update must never let a client
// supply row-level fields it doesn't own (`id`, `userId`) or arbitrary
// unknown columns. `isDefault` is a genuinely client-settable flag
// (promoting a default), so it stays in the allowlist; the server forces
// `userId` on create. Only these columns are ever written through.
const ADDRESS_ALLOWED_FIELDS = [
  'fullName', 'phone', 'country', 'address', 'city', 'province',
  'region', 'barangay', 'zipCode', 'isDefault',
];

function pickAddressFields(input) {
  const result = {};
  for (const key of ADDRESS_ALLOWED_FIELDS) {
    if (input[key] !== undefined) result[key] = input[key];
  }
  return result;
}

export async function addAddress(userId, addressData, { client } = {}) {
  const data = pickAddressFields(addressData);
  const run = async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    await tx.address.create({ data: { ...data, userId } });
  };
  client ? await run(client) : await prisma.$transaction(run);
  return findById(userId, { client });
}

export async function updateAddress(userId, addressId, updates, { client } = {}) {
  const owned = await (client ?? prisma).address.findFirst({ where: { id: addressId, userId } });
  if (!owned) return null;

  const data = pickAddressFields(updates);
  const run = async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    await tx.address.update({ where: { id: addressId }, data });
  };
  client ? await run(client) : await prisma.$transaction(run);
  return findById(userId, { client });
}

export async function deleteAddress(userId, addressId, { client } = {}) {
  const owned = await (client ?? prisma).address.findFirst({ where: { id: addressId, userId } });
  if (!owned) return null;

  const run = async (tx) => {
    await tx.address.delete({ where: { id: addressId } });

    // If the deleted address was the default, promote the first remaining
    // one — matches the original route's exact fallback behavior.
    if (owned.isDefault) {
      const remaining = await tx.address.findFirst({ where: { userId } });
      if (remaining) {
        await tx.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
      }
    }
  };
  client ? await run(client) : await prisma.$transaction(run);
  return findById(userId, { client });
}

export default {
  sanitize,
  comparePassword,
  findById,
  findByEmail,
  findByGoogleId,
  findByFacebookId,
  findByGoogleIdOrEmail,
  findByVerificationToken,
  findByResetToken,
  find,
  count,
  create,
  updateById,
  addAddress,
  updateAddress,
  deleteAddress,
};
