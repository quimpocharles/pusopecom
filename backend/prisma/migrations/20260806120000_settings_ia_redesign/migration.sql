-- AlterTable
ALTER TABLE "site_settings" DROP COLUMN "tryOnImage",
DROP COLUMN "tryOnProductUrl",
DROP COLUMN "tryOnTitle",
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "updatedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
