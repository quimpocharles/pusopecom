ALTER TABLE "orders" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);

-- Existing paid orders predate this delivery marker. Preserve their history
-- without sending duplicate confirmations; keep recent paid rows eligible so
-- a deployment can recover an email that failed immediately before rollout.
UPDATE "orders"
SET "confirmationEmailSentAt" = "updatedAt"
WHERE "paymentStatus" = 'paid'
  AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '1 hour';

CREATE INDEX "orders_paymentStatus_confirmationEmailSentAt_updatedAt_idx"
ON "orders"("paymentStatus", "confirmationEmailSentAt", "updatedAt");
