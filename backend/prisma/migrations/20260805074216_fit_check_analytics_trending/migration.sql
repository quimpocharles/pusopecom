-- AlterEnum
ALTER TYPE "HomepageSectionKey" ADD VALUE 'trendingFitChecks';

-- AlterTable
ALTER TABLE "fit_check_campaigns" ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "fitCheckTrendingLimit" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "fitCheckTrendingWindowDays" INTEGER NOT NULL DEFAULT 7;
