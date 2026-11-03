-- CreateEnum
CREATE TYPE "PublishingJobStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'RETRY_PENDING', 'CANCELLED', 'REQUIRES_REAUTH', 'ASSISTED_REQUIRED');

-- CreateTable
CREATE TABLE "PublishingJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "postTargetId" TEXT,
    "socialAccountId" TEXT,
    "platformCode" "SocialPlatformCode" NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "approvalVerifiedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "status" "PublishingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "idempotencyKey" TEXT NOT NULL,
    "externalPostId" TEXT,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishingJob_idempotencyKey_key" ON "PublishingJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublishingJob_status_nextAttemptAt_scheduledAt_idx" ON "PublishingJob"("status", "nextAttemptAt", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublishingJob_companyId_createdAt_idx" ON "PublishingJob"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishingJob_postId_idx" ON "PublishingJob"("postId");

-- CreateIndex
CREATE INDEX "PublishingEvent_jobId_createdAt_idx" ON "PublishingEvent"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublishingJob" ADD CONSTRAINT "PublishingJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingJob" ADD CONSTRAINT "PublishingJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingJob" ADD CONSTRAINT "PublishingJob_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingEvent" ADD CONSTRAINT "PublishingEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PublishingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
