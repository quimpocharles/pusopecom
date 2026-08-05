-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentReminderTiers" TEXT[] DEFAULT ARRAY[]::TEXT[];
