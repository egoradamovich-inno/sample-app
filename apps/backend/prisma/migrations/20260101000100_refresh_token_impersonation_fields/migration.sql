-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "impersonatedBy" TEXT,
ADD COLUMN "maxExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
