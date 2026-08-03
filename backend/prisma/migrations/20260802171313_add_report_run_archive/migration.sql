-- CreateEnum
CREATE TYPE "ReportRunType" AS ENUM ('daily_business_report');

-- CreateEnum
CREATE TYPE "ReportRunStatus" AS ENUM ('sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "report_runs" (
    "id" TEXT NOT NULL,
    "type" "ReportRunType" NOT NULL DEFAULT 'daily_business_report',
    "status" "ReportRunStatus" NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "data" JSONB,
    "recipients" TEXT[],
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_runs_type_createdAt_idx" ON "report_runs"("type", "createdAt" DESC);
