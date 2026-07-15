-- CreateTable
CREATE TABLE "platform_tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "latestStatus" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "maxActivePropertyEngagements" INTEGER,
    "maxDocumentsStorageMb" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_tenants_pkey" PRIMARY KEY ("id")
);
