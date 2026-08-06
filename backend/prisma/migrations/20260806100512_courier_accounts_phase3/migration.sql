-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "courierAccountId" TEXT;

-- CreateTable
CREATE TABLE "courier_accounts" (
    "id" TEXT NOT NULL,
    "courierName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_accounts_courierName_key" ON "courier_accounts"("courierName");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "courier_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
