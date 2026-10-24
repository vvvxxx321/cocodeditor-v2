-- CreateEnum
CREATE TYPE "ExecStatus" AS ENUM ('PENDING_ENQUEUE', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "ExecutionJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "stdin" TEXT NOT NULL DEFAULT '',
    "status" "ExecStatus" NOT NULL DEFAULT 'PENDING_ENQUEUE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "judge0Token" TEXT,
    "submittedAt" TIMESTAMP(3),
    "stdout" TEXT,
    "stderr" TEXT,
    "compileOutput" TEXT,
    "judge0Status" TEXT,
    "timeMs" INTEGER,
    "memoryKb" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enqueuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionJob_projectId_createdAt_idx" ON "ExecutionJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionJob_status_createdAt_idx" ON "ExecutionJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionJob_userId_idempotencyKey_key" ON "ExecutionJob"("userId", "idempotencyKey");

