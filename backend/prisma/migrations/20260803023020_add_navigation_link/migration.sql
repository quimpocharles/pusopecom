-- CreateTable
CREATE TABLE "navigation_links" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_links_active_displayOrder_idx" ON "navigation_links"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "navigation_links_parentId_idx" ON "navigation_links"("parentId");

-- AddForeignKey
ALTER TABLE "navigation_links" ADD CONSTRAINT "navigation_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "navigation_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
