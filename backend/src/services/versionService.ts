import { Prisma, VersionReason } from '@prisma/client';
import { prisma } from '../database/prismaClient';

type Tx = Prisma.TransactionClient;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export const versionService = {
  /** Inserts the next version number for the file. Call inside a transaction. */
  async insertVersion(tx: Tx, data: {
    fileId: string; reason: VersionReason; content: string; yjsState?: Buffer | null; authorId?: string | null;
  }) {
    const last = await tx.fileVersion.findFirst({
      where: { fileId: data.fileId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true },
    });
    return tx.fileVersion.create({
      data: { ...data, yjsState: data.yjsState ?? null, versionNumber: (last?.versionNumber ?? 0) + 1 },
      select: { id: true, fileId: true, versionNumber: true, reason: true, authorId: true, createdAt: true, content: true },
    });
  },

  /**
   * Runs `fn` in a transaction, retrying when two writers picked the same version number
   * (unique (fileId, versionNumber) violation). The collab process also serializes versions per
   * document; the retry covers writers in different processes.
   */
  async withVersionTx<T>(fn: (tx: Tx) => Promise<T>, attempts = 5): Promise<T> {
    for (let i = 1; ; i++) {
      try {
        return await prisma.$transaction(fn);
      } catch (err) {
        if (!isUniqueViolation(err) || i >= attempts) throw err;
      }
    }
  },

  /** Metadata only (no content/blob), newest first. */
  listVersions(fileId: string) {
    return prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, reason: true, authorId: true, createdAt: true },
    });
  },

  getVersion(fileId: string, versionId: string) {
    return prisma.fileVersion.findFirst({
      where: { id: versionId, fileId },
      select: { id: true, fileId: true, versionNumber: true, reason: true, authorId: true, createdAt: true, content: true },
    });
  },
};
