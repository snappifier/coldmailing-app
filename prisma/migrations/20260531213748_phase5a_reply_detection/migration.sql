-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "lastHistoryId" TEXT;
