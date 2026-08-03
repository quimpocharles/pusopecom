-- AlterTable
ALTER TABLE "promo_messages" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3);
