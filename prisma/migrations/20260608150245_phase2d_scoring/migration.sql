-- CreateEnum
CREATE TYPE "ResearchTypeKind" AS ENUM ('RESEARCH', 'SCORING');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "score" INTEGER;

-- AlterTable
ALTER TABLE "ResearchType" ADD COLUMN     "kind" "ResearchTypeKind" NOT NULL DEFAULT 'RESEARCH';
