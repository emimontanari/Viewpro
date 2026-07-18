-- CreateEnum
CREATE TYPE "PlatformOperatorRole" AS ENUM ('OWNER', 'OPERATIONS', 'ANALYST');

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "role" "PlatformOperatorRole" NOT NULL DEFAULT 'OWNER';
