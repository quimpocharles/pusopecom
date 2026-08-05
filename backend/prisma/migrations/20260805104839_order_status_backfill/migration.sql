-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "orderStatus" SET DEFAULT 'awaiting_payment';

-- Backfill existing rows into the new, more granular vocabulary. Uses
-- paymentStatus to disambiguate what the old, single "processing" default
-- actually meant for a given row, rather than a blind rename:
--
--   orderStatus='processing' AND paymentStatus='failed'  -> failed_payment
--     (a payment failure never touched orderStatus before this phase —
--     applyPaymentResolution's failed/expired branch only ever set
--     paymentStatus, so these rows are stuck at the old default and need
--     this backfill to reflect what actually happened to them)
--   orderStatus='processing' AND paymentStatus<>'failed' -> awaiting_payment
--     (the common case: never resolved either way — genuinely still
--     awaiting payment under the new model)
--   orderStatus='confirmed' (any paymentStatus)           -> paid
--     ('confirmed' was only ever set in the same atomic update as
--     paymentStatus='paid', so every 'confirmed' row is a real paid order)
UPDATE "orders" SET "orderStatus" = 'failed_payment' WHERE "orderStatus" = 'processing' AND "paymentStatus" = 'failed';
UPDATE "orders" SET "orderStatus" = 'awaiting_payment' WHERE "orderStatus" = 'processing' AND "paymentStatus" <> 'failed';
UPDATE "orders" SET "orderStatus" = 'paid' WHERE "orderStatus" = 'confirmed';
