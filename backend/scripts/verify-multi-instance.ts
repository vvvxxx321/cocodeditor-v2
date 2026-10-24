/**
 * Tier T3: two SEPARATE Node.js API processes (ports 3101/3102) sharing Redis via the Socket.IO
 * Redis adapter. Seeds a throwaway team/project in the DEV database (backend/.env).
 * Usage: npx tsx scripts/verify-multi-instance.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { SignJWT } from 'jose';
import { io as ioClient, Socket } from 'socket.io-client';

const PORTS = [3101, 3102];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitHttp(port: number) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/test`)).ok) return; } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`instance on ${port} did not start`);
}

async function main() {
  const { prisma } = await import('../src/database/prismaClient');
  const users = [randomUUID(), randomUUID()];
  for (const id of users) await prisma.profile.create({ data: { id, email: `mi-${id}@test.local`, name: 'mi' } });
  const team = await prisma.team.create({ data: { name: `mi-${Date.now()}`, ownerId: users[0] } });
  await prisma.teamMember.createMany({ data: users.map(id => ({ teamId: team.id, profileId: id, role: 'MEMBER' as const })) });
  const project = await prisma.project.create({ data: { name: 'mi', teamId: team.id } });
  const sign = (sub: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setAudience('authenticated')
    .setExpirationTime('10m').sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!));

  const procs: ChildProcess[] = PORTS.map(port => spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  }));
  const sockets: Socket[] = [];
  try {
    await Promise.all(PORTS.map(waitHttp));
    console.log(`instances up: pids ${procs.map(p => p.pid).join(', ')} on ports ${PORTS.join(', ')}`);
    for (let i = 0; i < 2; i++) {
      const s = ioClient(`http://127.0.0.1:${PORTS[i]}`, { transports: ['websocket'], auth: { token: await sign(users[i]) } });
      await new Promise<void>((res, rej) => { s.on('connect', () => res()); s.on('connect_error', rej); });
      const files = new Promise(r => s.once('filesUpdate', r));
      s.emit('joinProject', { projectId: project.id });
      await files;
      sockets.push(s);
    }
    const t0 = Date.now();
    const received = new Promise<any>(r => sockets[1].once('fileCreated', r));
    sockets[0].emit('createFile', { projectId: project.id, filename: 'from-3101.js', content: '' });
    const evt = await Promise.race([received, sleep(5000).then(() => null)]);
    console.log(JSON.stringify({ check: 'fileCreated 3101 -> 3102', pass: !!evt, path: evt?.path, latencyMsIncludingDbWrite: Date.now() - t0 }));
    const presence = await new Promise<any>(r => { sockets[1].once('projectUsers', r); sockets[0].emit('joinProject', { projectId: project.id }); });
    const ids = presence.map((u: any) => u.id);
    const presencePass = users.every(u => ids.includes(u));
    console.log(JSON.stringify({ check: 'presence on 3102 includes user on 3101', pass: presencePass }));
    console.log(evt && presencePass ? 'PASSED' : 'FAILED');
    process.exitCode = evt && presencePass ? 0 : 1;
  } finally {
    sockets.forEach(s => s.close());
    procs.forEach(p => p.kill('SIGTERM'));
    await prisma.$disconnect();
  }
}
main().catch(err => { console.error('ERROR', err); process.exit(1); });
