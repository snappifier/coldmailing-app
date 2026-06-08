-- CreateEnum
CREATE TYPE "ResearchBatchStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'PARTIAL', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ResearchRunStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "ResearchRun" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "modelIdSnapshot" TEXT,
ADD COLUMN     "outputFieldsSnapshot" JSONB,
ADD COLUMN     "promptSnapshot" TEXT,
ADD COLUMN     "webSearchEnabledSnapshot" BOOLEAN;

-- CreateTable
CREATE TABLE "ResearchBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "researchTypeId" TEXT,
    "researchTypeName" TEXT NOT NULL,
    "promptSnapshot" TEXT NOT NULL,
    "outputFieldsSnapshot" JSONB NOT NULL,
    "modelIdSnapshot" TEXT,
    "webSearchEnabled" BOOLEAN NOT NULL,
    "mode" "ResearchApplyMode" NOT NULL DEFAULT 'AUTO',
    "status" "ResearchBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "criteria" JSONB NOT NULL,
    "includeRecent" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchBatch_organizationId_createdAt_idx" ON "ResearchBatch"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRun_organizationId_batchId_idx" ON "ResearchRun"("organizationId", "batchId");

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBatch" ADD CONSTRAINT "ResearchBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBatch" ADD CONSTRAINT "ResearchBatch_researchTypeId_fkey" FOREIGN KEY ("researchTypeId") REFERENCES "ResearchType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBatch" ADD CONSTRAINT "ResearchBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
