-- AlterTable
ALTER TABLE "User" ADD COLUMN "mtcdPersonId" TEXT;
ALTER TABLE "User" ADD COLUMN "mtcdIdentitySource" TEXT;
ALTER TABLE "User" ADD COLUMN "mtcdLastSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_mtcdPersonId_key" ON "User"("mtcdPersonId");

-- AlterTable
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "iamApiKey" TEXT;
