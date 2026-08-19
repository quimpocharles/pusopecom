-- CreateEnum
CREATE TYPE "SeatingType" AS ENUM ('RESERVED_SEAT', 'GENERAL_ADMISSION');

-- CreateEnum
CREATE TYPE "PassEventSeatStatus" AS ENUM ('available', 'held', 'sold');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('reserved', 'issued', 'checked_in', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PassLogType" AS ENUM ('created', 'status_changed');

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capacity" INTEGER,
    "mapImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sections" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seatingType" "SeatingType" NOT NULL,
    "rows" INTEGER,
    "seatsPerRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "venueSectionId" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[],
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "venueId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_tiers" (
    "id" TEXT NOT NULL,
    "passEventId" TEXT NOT NULL,
    "venueSectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER,
    "sold" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_event_seats" (
    "id" TEXT NOT NULL,
    "passEventId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "PassEventSeatStatus" NOT NULL DEFAULT 'available',
    "heldUntil" TIMESTAMP(3),
    "holdToken" TEXT,

    CONSTRAINT "pass_event_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "passEventId" TEXT NOT NULL,
    "passTierId" TEXT NOT NULL,
    "passEventSeatId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "PassStatus" NOT NULL DEFAULT 'reserved',
    "qrToken" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_logs" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "type" "PassLogType" NOT NULL,
    "actor" "OrderEventActor" NOT NULL,
    "actorUserId" TEXT,
    "fromStatus" "PassStatus",
    "toStatus" "PassStatus",
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pass_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE INDEX "venue_sections_venueId_idx" ON "venue_sections"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "seats_venueSectionId_row_seatNumber_key" ON "seats"("venueSectionId", "row", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pass_events_slug_key" ON "pass_events"("slug");

-- CreateIndex
CREATE INDEX "pass_events_organizationId_active_idx" ON "pass_events"("organizationId", "active");

-- CreateIndex
CREATE INDEX "pass_events_venueId_idx" ON "pass_events"("venueId");

-- CreateIndex
CREATE INDEX "pass_events_startsAt_idx" ON "pass_events"("startsAt");

-- CreateIndex
CREATE INDEX "pass_tiers_passEventId_idx" ON "pass_tiers"("passEventId");

-- CreateIndex
CREATE INDEX "pass_event_seats_status_heldUntil_idx" ON "pass_event_seats"("status", "heldUntil");

-- CreateIndex
CREATE UNIQUE INDEX "pass_event_seats_passEventId_seatId_key" ON "pass_event_seats"("passEventId", "seatId");

-- CreateIndex
CREATE UNIQUE INDEX "passes_qrToken_key" ON "passes"("qrToken");

-- CreateIndex
CREATE INDEX "passes_orderId_idx" ON "passes"("orderId");

-- CreateIndex
CREATE INDEX "passes_passEventId_idx" ON "passes"("passEventId");

-- CreateIndex
CREATE INDEX "passes_qrToken_idx" ON "passes"("qrToken");

-- CreateIndex
CREATE INDEX "pass_logs_passId_createdAt_idx" ON "pass_logs"("passId", "createdAt");

-- AddForeignKey
ALTER TABLE "venue_sections" ADD CONSTRAINT "venue_sections_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_venueSectionId_fkey" FOREIGN KEY ("venueSectionId") REFERENCES "venue_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_events" ADD CONSTRAINT "pass_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_events" ADD CONSTRAINT "pass_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_events" ADD CONSTRAINT "pass_events_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_passEventId_fkey" FOREIGN KEY ("passEventId") REFERENCES "pass_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_venueSectionId_fkey" FOREIGN KEY ("venueSectionId") REFERENCES "venue_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_event_seats" ADD CONSTRAINT "pass_event_seats_passEventId_fkey" FOREIGN KEY ("passEventId") REFERENCES "pass_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_event_seats" ADD CONSTRAINT "pass_event_seats_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_passEventId_fkey" FOREIGN KEY ("passEventId") REFERENCES "pass_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_passTierId_fkey" FOREIGN KEY ("passTierId") REFERENCES "pass_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_passEventSeatId_fkey" FOREIGN KEY ("passEventSeatId") REFERENCES "pass_event_seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_logs" ADD CONSTRAINT "pass_logs_passId_fkey" FOREIGN KEY ("passId") REFERENCES "passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_logs" ADD CONSTRAINT "pass_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

