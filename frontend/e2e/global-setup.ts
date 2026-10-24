import { spawn, execSync, ChildProcess } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { startFakeJudge0 } from '../../backend/test/fakes/fakeJudge0';

// frontend is an ES module package: no __dirname; backend deps are loaded from backend/node_modules.
const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(here, '../../backend');
const FRONTEND = path.resolve(here, '..');
const backendRequire = createRequire(path.join(BACKEND, 'package.json'));
const { SignJWT } = backendRequire('jose');
const PORTS = { api: 3300, collab: 1300, web: 5300 };
const user = process.env.PGUSER || os.userInfo().username;
const DB = process.env.E2E_DATABASE_URL || `postgresql://${user}@localhost:5432/cocodeditor_v2_e2e`;

async function waitFor(url: string, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${url}`);
}

export default async function globalSetup() {
  try { execSync('createdb cocodeditor_v2_e2e', { stdio: 'ignore' }); } catch { /* exists */ }
  execSync('npx prisma migrate deploy', { cwd: BACKEND, env: { ...process.env, DATABASE_URL: DB, DIRECT_URL: DB }, stdio: 'ignore' });

  const secret = randomBytes(32).toString('hex');
  const judge0 = await startFakeJudge0();
  const env = {
    ...process.env, NODE_ENV: 'development', LOG_LEVEL: 'warn', DATABASE_URL: DB, DIRECT_URL: DB,
    SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_JWT_SECRET: secret,
    REDIS_URL: 'redis://127.0.0.1:6379/14', PORT: String(PORTS.api), COLLAB_PORT: String(PORTS.collab),
    COLLAB_INTERNAL_URL: `http://127.0.0.1:${PORTS.collab}`, COLLAB_INTERNAL_SECRET: randomBytes(16).toString('hex'),
    CORS_ORIGINS: `http://localhost:${PORTS.web}`, JUDGE0_API_URL: judge0.url, JUDGE0_API_KEY: '', EXEC_POLL_MS: '100',
  };
  const procs: ChildProcess[] = [];
  const start = (cwd: string, args: string[], extra: Record<string, string> = {}) => {
    const p = spawn(args[0], args.slice(1), { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'ignore', 'inherit'] });
    procs.push(p);
  };
  start(BACKEND, [process.execPath, '--import', 'tsx', 'src/index.ts']);
  start(BACKEND, [process.execPath, '--import', 'tsx', 'src/collab/index.ts']);
  start(BACKEND, [process.execPath, '--import', 'tsx', 'src/worker/index.ts']);
  start(FRONTEND, [process.execPath, 'node_modules/vite/bin/vite.js', '--port', String(PORTS.web), '--strictPort'], {
    VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'e2e-anon-placeholder',
    VITE_API_URL: `http://localhost:${PORTS.api}`, VITE_COLLAB_URL: `ws://localhost:${PORTS.collab}`,
    VITE_PROXY_TARGET: `http://localhost:${PORTS.api}`,
  });
  await Promise.all([
    waitFor(`http://localhost:${PORTS.api}/healthz`),
    waitFor(`http://localhost:${PORTS.collab}/`),
    waitFor(`http://localhost:${PORTS.web}/`),
  ]);

  // Seed a team with two members and a project with one file.
  const { PrismaClient } = backendRequire('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const alice = randomUUID(), bob = randomUUID();
  await prisma.profile.createMany({ data: [
    { id: alice, email: `alice-${alice}@test.local`, name: 'alice' }, { id: bob, email: `bob-${bob}@test.local`, name: 'bob' },
  ] });
  const team = await prisma.team.create({ data: { name: `e2e-${Date.now()}`, ownerId: alice } });
  await prisma.teamMember.createMany({ data: [
    { teamId: team.id, profileId: alice, role: 'ADMIN' }, { teamId: team.id, profileId: bob, role: 'MEMBER' },
  ] });
  const project = await prisma.project.create({ data: { name: 'E2E Project', teamId: team.id } });
  const file = await prisma.file.create({ data: { name: 'main.py', content: 'print("seed")\n', language: 'python', projectId: project.id } });
  await prisma.$disconnect();

  const sign = (sub: string, email: string) => new SignJWT({ email, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(sub).setAudience('authenticated')
    .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(secret));
  process.env.E2E_DATA = JSON.stringify({
    projectId: project.id, fileId: file.id,
    users: {
      alice: { id: alice, email: `alice-${alice}@test.local`, token: await sign(alice, `alice-${alice}@test.local`) },
      bob: { id: bob, email: `bob-${bob}@test.local`, token: await sign(bob, `bob-${bob}@test.local`) },
    },
  });

  return async () => {
    procs.forEach(p => p.kill('SIGTERM'));
    await judge0.close();
  };
}
