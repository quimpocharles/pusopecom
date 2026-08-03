-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "DashboardWidgetKey" AS ENUM ('todaysRevenue', 'todaysOrders', 'lowStock', 'pendingShipments', 'failedPayments', 'mostViewedProducts', 'mostTriedOnProducts');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportRunType" ADD VALUE 'weekly_business_report';
ALTER TYPE "ReportRunType" ADD VALUE 'monthly_business_report';
ALTER TYPE "ReportRunType" ADD VALUE 'quarterly_business_report';

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "key" "DashboardWidgetKey" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_schedules_frequency_key" ON "report_schedules"("frequency");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_widgets_key_key" ON "dashboard_widgets"("key");
