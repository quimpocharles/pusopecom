-- DropForeignKey
ALTER TABLE "pass_event_seats" DROP CONSTRAINT "pass_event_seats_passEventId_fkey";

-- DropForeignKey
ALTER TABLE "pass_event_seats" DROP CONSTRAINT "pass_event_seats_seatId_fkey";

-- DropForeignKey
ALTER TABLE "passes" DROP CONSTRAINT "passes_passEventSeatId_fkey";

-- DropForeignKey
ALTER TABLE "seats" DROP CONSTRAINT "seats_venueSectionId_fkey";

-- AlterTable
ALTER TABLE "passes" DROP COLUMN "passEventSeatId";

-- AlterTable
ALTER TABLE "venue_sections" DROP COLUMN "rows",
DROP COLUMN "seatingType",
DROP COLUMN "seatsPerRow";

-- AlterTable
ALTER TABLE "venues" DROP COLUMN "mapImageUrl",
ADD COLUMN     "seatingChartUrl" TEXT;

-- DropTable
DROP TABLE "pass_event_seats";

-- DropTable
DROP TABLE "seats";

-- DropEnum
DROP TYPE "PassEventSeatStatus";

-- DropEnum
DROP TYPE "SeatingType";

