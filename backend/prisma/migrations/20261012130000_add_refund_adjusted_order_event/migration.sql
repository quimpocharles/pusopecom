-- AlterEnum
-- Stage 2, Step 3 — the refund-adjustment endpoint records an amount-only
-- correction (previous amount, new amount, reason, adjustment mode, actor) as
-- its own audit event, distinct from refund_recorded (which finalizes a refund
-- as externally completed). Appending a value to an existing enum needs no
-- other statement in this migration to read or write it.
ALTER TYPE "OrderEventType" ADD VALUE 'refund_adjusted';
