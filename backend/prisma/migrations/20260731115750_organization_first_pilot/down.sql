-- Manual down-migration for 20260731115750_organization_first_pilot.
-- Prisma has no native down-migration mechanism; this file is a reviewed,
-- ready-to-run rollback artifact, not something Prisma applies
-- automatically. Apply with `psql "$DATABASE_URL" -f down.sql` (or the
-- equivalent Prisma $executeRawUnsafe runner) only if this migration needs
-- to be fully reverted.
--
-- Safe to run against a live server with traffic: nothing in the
-- application reads any of these tables/columns yet (see the
-- organizationId/teamId comments on Product and League in schema.prisma),
-- so dropping them cannot break a running request. Reverse dependency
-- order: FKs first, then tables, then the new columns, then the enums.

ALTER TABLE "leagues" DROP CONSTRAINT IF EXISTS "leagues_organizationId_fkey";
ALTER TABLE "athlete_affiliations" DROP CONSTRAINT IF EXISTS "athlete_affiliations_teamId_fkey";
ALTER TABLE "athlete_affiliations" DROP CONSTRAINT IF EXISTS "athlete_affiliations_organizationId_fkey";
ALTER TABLE "athlete_affiliations" DROP CONSTRAINT IF EXISTS "athlete_affiliations_athleteOrganizationId_fkey";
ALTER TABLE "organization_participations" DROP CONSTRAINT IF EXISTS "organization_participations_inOrganizationId_fkey";
ALTER TABLE "organization_participations" DROP CONSTRAINT IF EXISTS "organization_participations_memberOrganizationId_fkey";
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_organizationId_fkey";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_verifiedByUserId_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_teamId_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_organizationId_fkey";

DROP TABLE IF EXISTS "athlete_affiliations";
DROP TABLE IF EXISTS "organization_participations";
DROP TABLE IF EXISTS "teams";
DROP TABLE IF EXISTS "organizations";

ALTER TABLE "leagues" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "products" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "products" DROP COLUMN IF EXISTS "teamId";

DROP TYPE IF EXISTS "VerificationStatus";
DROP TYPE IF EXISTS "OrganizationKind";
