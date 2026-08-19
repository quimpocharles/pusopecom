-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "gatewayFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paymentChannel" TEXT,
ALTER COLUMN "paymentMethod" SET DEFAULT 'xendit';

