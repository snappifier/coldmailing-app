-- CreateEnum
CREATE TYPE "OptOutMode" AS ENUM ('OFF', 'SUGGEST', 'AUTO');

-- CreateEnum
CREATE TYPE "OptOutDetector" AS ENUM ('KEYWORD', 'LLM');

-- CreateEnum
CREATE TYPE "InboundKind" AS ENUM ('REPLY', 'BOUNCE', 'AUTO_REPLY', 'OPT_OUT_SUSPECT');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "inboundKind" "InboundKind";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "optOutDetector" "OptOutDetector" NOT NULL DEFAULT 'KEYWORD',
ADD COLUMN     "optOutMode" "OptOutMode" NOT NULL DEFAULT 'OFF';
