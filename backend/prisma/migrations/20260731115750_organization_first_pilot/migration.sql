-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('institution', 'league', 'athlete');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'requested', 'reviewed', 'granted', 'flagged', 'revoked');

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortName" TEXT,
    "kind" "OrganizationKind" NOT NULL DEFAULT 'institution',
    "description" TEXT,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "verificationRequestedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_participations" (
    "id" TEXT NOT NULL,
    "memberOrganizationId" TEXT NOT NULL,
    "inOrganizationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_affiliations" (
    "id" TEXT NOT NULL,
    "athleteOrganizationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_kind_active_idx" ON "organizations"("kind", "active");

-- CreateIndex
CREATE INDEX "teams_organizationId_sport_idx" ON "teams"("organizationId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_slug_key" ON "teams"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "organization_participations_inOrganizationId_idx" ON "organization_participations"("inOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_participations_memberOrganizationId_inOrganiza_key" ON "organization_participations"("memberOrganizationId", "inOrganizationId");

-- CreateIndex
CREATE INDEX "athlete_affiliations_organizationId_idx" ON "athlete_affiliations"("organizationId");

-- CreateIndex
CREATE INDEX "athlete_affiliations_teamId_idx" ON "athlete_affiliations"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_affiliations_athleteOrganizationId_organizationId_t_key" ON "athlete_affiliations"("athleteOrganizationId", "organizationId", "teamId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_organizationId_key" ON "leagues"("organizationId");

-- CreateIndex
CREATE INDEX "products_organizationId_active_idx" ON "products"("organizationId", "active");

-- CreateIndex
CREATE INDEX "products_teamId_idx" ON "products"("teamId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_participations" ADD CONSTRAINT "organization_participations_memberOrganizationId_fkey" FOREIGN KEY ("memberOrganizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_participations" ADD CONSTRAINT "organization_participations_inOrganizationId_fkey" FOREIGN KEY ("inOrganizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_athleteOrganizationId_fkey" FOREIGN KEY ("athleteOrganizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

