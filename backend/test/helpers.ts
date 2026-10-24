import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '../src/database/prismaClient';

/** Mint a Supabase-shaped HS256 access token with the per-run test secret (see vitest.config.ts). */
export async function signToken(userId: string, opts: { expiresIn?: string; secret?: string; aud?: string } = {}) {
  const secret = new TextEncoder().encode(opts.secret ?? process.env.SUPABASE_JWT_SECRET!);
  return new SignJWT({ email: `${userId}@test.local`, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(secret);
}

/** Truncates the dedicated *test* database only. */
export async function resetDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('_test')) throw new Error(`Refusing to reset non-test database: ${url}`);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} CASCADE`);
  }
}

export interface Fixture {
  owner: string; admin: string; member: string; viewer: string; outsider: string;
  teamId: string; projectId: string; fileId: string; otherProjectId: string; otherFileId: string;
}

/** owner/admin/member/viewer belong to team A; outsider owns team B. */
export async function seedFixture(fileContent = 'console.log("v1");\n'): Promise<Fixture> {
  const ids = { owner: randomUUID(), admin: randomUUID(), member: randomUUID(), viewer: randomUUID(), outsider: randomUUID() };
  for (const [name, id] of Object.entries(ids)) {
    await prisma.profile.create({ data: { id, email: `${name}-${id}@test.local`, name } });
  }
  const team = await prisma.team.create({ data: { name: 'Team A', ownerId: ids.owner } });
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, profileId: ids.owner, role: Role.ADMIN }, // V1 creates owners as ADMIN members
      { teamId: team.id, profileId: ids.admin, role: Role.ADMIN },
      { teamId: team.id, profileId: ids.member, role: Role.MEMBER },
      { teamId: team.id, profileId: ids.viewer, role: Role.VIEWER },
    ],
  });
  const project = await prisma.project.create({ data: { name: 'P1', teamId: team.id } });
  const file = await prisma.file.create({ data: { name: 'main.js', content: fileContent, language: 'javascript', projectId: project.id } });

  const otherTeam = await prisma.team.create({ data: { name: 'Team B', ownerId: ids.outsider } });
  await prisma.teamMember.create({ data: { teamId: otherTeam.id, profileId: ids.outsider, role: Role.ADMIN } });
  const otherProject = await prisma.project.create({ data: { name: 'P2', teamId: otherTeam.id } });
  const otherFile = await prisma.file.create({ data: { name: 'secret.py', content: 'print("secret")', projectId: otherProject.id } });

  return { ...ids, teamId: team.id, projectId: project.id, fileId: file.id, otherProjectId: otherProject.id, otherFileId: otherFile.id };
}

export const waitFor = async (cond: () => boolean | Promise<boolean>, timeoutMs = 5000, stepMs = 20) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return;
    await new Promise(r => setTimeout(r, stepMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
};
