-- CreateTable
CREATE TABLE "FileDocument" (
    "fileId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileDocument_pkey" PRIMARY KEY ("fileId")
);

