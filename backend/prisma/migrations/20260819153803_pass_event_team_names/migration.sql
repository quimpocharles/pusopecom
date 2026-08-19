-- DropForeignKey
ALTER TABLE "pass_events" DROP CONSTRAINT "pass_events_teamId_fkey";

-- AlterTable
ALTER TABLE "pass_events" DROP COLUMN "teamId",
ADD COLUMN     "teamNames" TEXT[];

