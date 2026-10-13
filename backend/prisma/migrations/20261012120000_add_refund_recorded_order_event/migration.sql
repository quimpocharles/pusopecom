-- AlterEnum
-- Manual refund recording (Stage 1) appends a dedicated refund_recorded
-- audit event to an Order's timeline — a distinct event type from the generic
-- status_updated, so a staff-recorded refund is queryable on its own. Appending
-- a value to an existing enum is safe without a separate migration here: only
-- the value is added, and no statement in this migration reads or writes it.
ALTER TYPE "OrderEventType" ADD VALUE 'refund_recorded';
