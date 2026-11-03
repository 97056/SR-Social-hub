-- CreateEnum
CREATE TYPE "ApprovalStep" AS ENUM ('CLIENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'INVALIDATED');

-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN     "currentApprovalStep" "ApprovalStep";

-- CreateTable
CREATE TABLE "PostApproval" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "step" "ApprovalStep" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostApproval_postId_revision_idx" ON "PostApproval"("postId", "revision");

-- CreateIndex
CREATE INDEX "PostApproval_decision_step_idx" ON "PostApproval"("decision", "step");

-- CreateIndex
CREATE INDEX "PostApproval_approverId_idx" ON "PostApproval"("approverId");

-- CreateIndex
CREATE INDEX "ContentPost_status_currentApprovalStep_idx" ON "ContentPost"("status", "currentApprovalStep");

-- AddForeignKey
ALTER TABLE "PostApproval" ADD CONSTRAINT "PostApproval_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostApproval" ADD CONSTRAINT "PostApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
