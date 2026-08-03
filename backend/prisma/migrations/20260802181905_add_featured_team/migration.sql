-- CreateTable
CREATE TABLE "featured_teams" (
    "id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "featuredImage" TEXT,
    "featuredImageAlt" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "displayMonth" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_teams_active_startDate_endDate_idx" ON "featured_teams"("active", "startDate", "endDate");
