-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "EmailAccountStatus" AS ENUM ('CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CampaignLeadStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "CampaignLeadStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "sendingEmailAccountId" TEXT;

-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "lastError" TEXT;

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'GOOGLE',
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 40,
    "sendWindowStartMin" INTEGER NOT NULL DEFAULT 480,
    "sendWindowEndMin" INTEGER NOT NULL DEFAULT 960,
    "sendDays" INTEGER NOT NULL DEFAULT 31,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "minGapSec" INTEGER NOT NULL DEFAULT 180,
    "maxGapSec" INTEGER NOT NULL DEFAULT 600,
    "status" "EmailAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignLeadId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "intendedTo" TEXT NOT NULL,
    "actualTo" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_organizationId_email_key" ON "EmailAccount"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Message_emailAccountId_sentAt_idx" ON "Message"("emailAccountId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_campaignLeadId_idx" ON "Message"("campaignLeadId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_sendingEmailAccountId_fkey" FOREIGN KEY ("sendingEmailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignLeadId_fkey" FOREIGN KEY ("campaignLeadId") REFERENCES "CampaignLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
