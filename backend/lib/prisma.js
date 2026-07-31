import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient instance. Instantiating `new PrismaClient()` per
// module/request is a common, real Prisma footgun — each instance opens its
// own connection pool, and a long-running Express process doing that
// repeatedly exhausts Postgres's connection limit (a real risk called out
// explicitly in the migration plan). Every repository imports this one
// instance rather than constructing its own.
//
// In development, Vite/nodemon-style hot restarts can otherwise create a
// fresh client on every reload without the old one being garbage collected
// first; stashing it on `global` avoids that.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
