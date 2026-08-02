-- Written by hand instead of `prisma migrate dev`: Prisma's own diffing
-- treats an enum value rename as remove-old-value + add-new-value, which it
-- correctly refuses since a live homepage_sections row still uses
-- 'shopBySport'. RENAME VALUE preserves that row (and any FK/index on the
-- type) with no data rewrite — the safe, native Postgres operation for this.
ALTER TYPE "HomepageSectionKey" RENAME VALUE 'shopBySport' TO 'aiTryOn';

-- CreateEnum
CREATE TYPE "CampaignPlacement" AS ENUM ('hero', 'tryOn');

-- AlterTable: existing `campaigns` rows (there are none yet in production)
-- all get placement='hero' by default; every future insert sets it
-- explicitly per placement.
ALTER TABLE "campaigns" ADD COLUMN "placement" "CampaignPlacement" NOT NULL DEFAULT 'hero';
ALTER TABLE "campaigns" ADD COLUMN "subheadline" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "beforeImage" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "afterImage" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "featuredProductId" TEXT;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_featuredProductId_fkey" FOREIGN KEY ("featuredProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace the old two-column index with the placement-aware one that
-- matches campaignRepository.findActiveHomepageCampaign()'s new query shape.
DROP INDEX "campaigns_featuredOnHomepage_active_idx";
CREATE INDEX "campaigns_placement_featuredOnHomepage_active_idx" ON "campaigns"("placement", "featuredOnHomepage", "active");
