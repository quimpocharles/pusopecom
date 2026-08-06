-- Reports Module Redesign, Phase 3: the 5 AM daily slot's single email
-- splits into six, one per report workspace, each archived under its own
-- ReportRunType so it's independently downloadable in Exports > Archive.
ALTER TYPE "ReportRunType" ADD VALUE 'executive_daily_report';
ALTER TYPE "ReportRunType" ADD VALUE 'sales_report';
ALTER TYPE "ReportRunType" ADD VALUE 'inventory_report';
ALTER TYPE "ReportRunType" ADD VALUE 'fulfillment_report';
ALTER TYPE "ReportRunType" ADD VALUE 'fit_check_analytics_report';
ALTER TYPE "ReportRunType" ADD VALUE 'organization_performance_report';
