-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "ResearchTypeKind" ADD VALUE 'DRAFT';

-- CreateTable
CREATE TABLE "LeadDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "status" "DraftStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sourceTypeId" TEXT,
    "sourceTypeName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDraft_organizationId_leadId_idx" ON "LeadDraft"("organizationId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadDraft_organizationId_leadId_key" ON "LeadDraft"("organizationId", "leadId");

-- AddForeignKey
ALTER TABLE "LeadDraft" ADD CONSTRAINT "LeadDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDraft" ADD CONSTRAINT "LeadDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDraft" ADD CONSTRAINT "LeadDraft_sourceTypeId_fkey" FOREIGN KEY ("sourceTypeId") REFERENCES "ResearchType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDraft" ADD CONSTRAINT "LeadDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
