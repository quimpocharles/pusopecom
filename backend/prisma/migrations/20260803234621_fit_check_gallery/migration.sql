-- AlterTable
ALTER TABLE "try_on_logs" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "favorited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "generatedImagePublicId" TEXT,
ADD COLUMN     "generatedImageUrl" TEXT,
ADD COLUMN     "promptVersion" TEXT;

-- CreateIndex
CREATE INDEX "try_on_logs_userId_favorited_idx" ON "try_on_logs"("userId", "favorited");
