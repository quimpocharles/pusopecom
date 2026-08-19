-- AlterEnum
BEGIN;
CREATE TYPE "PassStatus_new" AS ENUM ('issued', 'checked_in', 'cancelled', 'refunded');
ALTER TABLE "passes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "passes" ALTER COLUMN "status" TYPE "PassStatus_new" USING ("status"::text::"PassStatus_new");
ALTER TABLE "pass_logs" ALTER COLUMN "fromStatus" TYPE "PassStatus_new" USING ("fromStatus"::text::"PassStatus_new");
ALTER TABLE "pass_logs" ALTER COLUMN "toStatus" TYPE "PassStatus_new" USING ("toStatus"::text::"PassStatus_new");
ALTER TYPE "PassStatus" RENAME TO "PassStatus_old";
ALTER TYPE "PassStatus_new" RENAME TO "PassStatus";
DROP TYPE "PassStatus_old";
ALTER TABLE "passes" ALTER COLUMN "status" SET DEFAULT 'issued';
COMMIT;

-- AlterTable
ALTER TABLE "passes" ALTER COLUMN "status" SET DEFAULT 'issued';

