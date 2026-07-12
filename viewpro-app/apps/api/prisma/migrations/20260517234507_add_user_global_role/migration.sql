-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'VIEWPRO_ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER';
