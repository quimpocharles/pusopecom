-- AlterEnum
-- Split into its own migration on purpose: Postgres cannot use a newly
-- added enum value (including in a column DEFAULT) within the same
-- transaction that adds it ("unsafe use of new value ... New enum values
-- must be committed before they can be used"). The DEFAULT change and the
-- backfill that reads/writes these new values live in the next migration,
-- applied only after this one has committed.

ALTER TYPE "OrderStatus" ADD VALUE 'awaiting_payment';
ALTER TYPE "OrderStatus" ADD VALUE 'paid';
ALTER TYPE "OrderStatus" ADD VALUE 'packed';
ALTER TYPE "OrderStatus" ADD VALUE 'returned';
ALTER TYPE "OrderStatus" ADD VALUE 'expired';
ALTER TYPE "OrderStatus" ADD VALUE 'failed_payment';
