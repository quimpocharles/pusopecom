-- CreateTable
CREATE TABLE "partner_logos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "league" TEXT,
    "logoUrl" TEXT NOT NULL,
    "destinationUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_logos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_logos_active_priority_displayOrder_idx" ON "partner_logos"("active", "priority", "displayOrder");
