-- AlterEnum
ALTER TYPE "PromoScope" ADD VALUE 'EVENT';

-- CreateTable
CREATE TABLE "promo_code_pass_events" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "passEventId" TEXT NOT NULL,

    CONSTRAINT "promo_code_pass_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_code_pass_events_passEventId_idx" ON "promo_code_pass_events"("passEventId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_pass_events_promoCodeId_passEventId_key" ON "promo_code_pass_events"("promoCodeId", "passEventId");

-- AddForeignKey
ALTER TABLE "promo_code_pass_events" ADD CONSTRAINT "promo_code_pass_events_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_pass_events" ADD CONSTRAINT "promo_code_pass_events_passEventId_fkey" FOREIGN KEY ("passEventId") REFERENCES "pass_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

