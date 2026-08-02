-- CreateEnum
CREATE TYPE "HomepageSectionKey" AS ENUM ('hero', 'shopBySport', 'marquee', 'featuredProducts', 'featuredTeam', 'partners', 'faq');

-- CreateEnum
CREATE TYPE "PromoPlacement" AS ENUM ('announcement', 'marquee');

-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" TEXT NOT NULL,
    "key" "HomepageSectionKey" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eyebrow" TEXT,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "ctaLabel" TEXT,
    "ctaLink" TEXT,
    "accentColor" TEXT,
    "featuredOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_messages" (
    "id" TEXT NOT NULL,
    "placement" "PromoPlacement" NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homepage_sections_key_key" ON "homepage_sections"("key");

-- CreateIndex
CREATE INDEX "campaigns_featuredOnHomepage_active_idx" ON "campaigns"("featuredOnHomepage", "active");

-- CreateIndex
CREATE INDEX "faq_items_active_displayOrder_idx" ON "faq_items"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "promo_messages_placement_active_displayOrder_idx" ON "promo_messages"("placement", "active", "displayOrder");
