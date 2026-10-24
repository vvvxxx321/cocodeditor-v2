/**
 * Tier T3 (real PostgreSQL) + T1 (pure RBAC). Phase 0 security regression tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { execFileSync } from 'child_process';
import { io as ioClient, Socket } from 'socket.io-client';
import { Role } from '@prisma/client';
import { createApp, startServer } from '../src/index';
import { prisma } from '../src/database/prismaClient';
import { can } from '../src/auth/rbac';
import { verifyAccessToken, AuthError } from '../src/auth/verifyToken';
import { resetDb, seedFixture, signToken, waitFor, Fixture } from './helpers';

const app = createApp();
let f: Fixture;
const tok: Record<string, string> = {};
const auth = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });

beforeAll(async () => {
  await resetDb();
  f = await seedFixture();
  for (const who of ['owner', 'admin', 'member', 'viewer', 'outsider'] as const) tok[who] = await signToken(f[who]);
});

describe('T1 rbac.can', () => {
  it('enforces role ordering VIEWER < MEMBER < ADMIN < OWNER', () => {
    expect(can(Role.VIEWER, 'read')).toBe(true);
    expect(can(Role.VIEWER, 'write')).toBe(false);
    expect(can(Role.VIEWER, 'run')).toBe(false);
    expect(can(Role.MEMBER, 'write')).toBe(true);
    expect(can(Role.MEMBER, 'restore')).toBe(true);
    expect(can(Role.MEMBER, 'delete')).toBe(false);
    expect(can(Role.ADMIN, 'delete')).toBe(true);
    expect(can(Role.OWNER, 'manageMembers')).toBe(true);
    expect(can(null, 'read')).toBe(false);
  });
});

describe('T1 verifyAccessToken', () => {
  it('accepts a valid token and maps sub -> id', async () => {
    expect((await verifyAccessToken(tok.member)).id).toBe(f.member);
  });
  it('rejects wrong secret, wrong audience, expired, alg=none, garbage', async () => {
    const bad = [
      await signToken(f.member, { secret: 'not-the-secret' }),
      await signToken(f.member, { aud: 'anon' }),
      await signToken(f.member, { expiresIn: '-1m' }),
      // unsigned token (alg: none)
      Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' +
        Buffer.from(JSON.stringify({ sub: f.member, aud: 'authenticated', exp: 9999999999 })).toString('base64url') + '.',
      'garbage',
    ];
    for (const t of bad) await expect(verifyAccessToken(t)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('T3 REST authentication & authorization', () => {
  it('401 without / with invalid token', async () => {
    await request(app).get(`/api/projects/${f.projectId}`).expect(401);
    await request(app).get(`/api/projects/${f.projectId}`).set('Authorization', 'Bearer nope').expect(401);
  });

  it('members (incl. viewer) can read the project; outsiders cannot (404, no existence leak)', async () => {
    await request(app).get(`/api/projects/${f.projectId}`).set(auth('viewer')).expect(200);
    await request(app).get(`/api/projects/${f.projectId}`).set(auth('outsider')).expect(404);
    await request(app).get(`/api/projects/team/${f.teamId}`).set(auth('outsider')).expect(404);
  });

  it('file IDOR closed: outsider cannot GET/PUT/DELETE another team\'s file', async () => {
    await request(app).get(`/api/files/${f.fileId}`).set(auth('outsider')).expect(404);
    await request(app).put(`/api/files/${f.fileId}`).set(auth('outsider')).send({ content: 'pwned' }).expect(404);
    await request(app).delete(`/api/files/${f.fileId}`).set(auth('outsider')).expect(404);
    await request(app).get(`/api/files/project/${f.projectId}`).set(auth('outsider')).expect(404);
    await request(app).post('/api/files').set(auth('outsider')).send({ name: 'x.js', projectId: f.projectId }).expect(404);
    const file = await prisma.file.findUnique({ where: { id: f.fileId } });
    expect(file?.content).not.toBe('pwned');
  });

  it('viewer can read files but not write them', async () => {
    await request(app).get(`/api/files/${f.fileId}`).set(auth('viewer')).expect(200);
    await request(app).put(`/api/files/${f.fileId}`).set(auth('viewer')).send({ content: 'x' }).expect(403);
    await request(app).put(`/api/files/${f.fileId}`).set(auth('member')).send({ content: 'member edit' }).expect(200);
  });

  it('S4 regression: MEMBER delete is rejected AND the project still exists', async () => {
    await request(app).delete(`/api/projects/${f.projectId}`).set(auth('member')).expect(403);
    expect(await prisma.project.findUnique({ where: { id: f.projectId } })).not.toBeNull();
  });

  it('outsider cannot create a project in someone else\'s team', async () => {
    await request(app).post('/api/projects').set(auth('outsider')).send({ name: 'evil', teamId: f.teamId }).expect(404);
    await request(app).post('/api/projects').set(auth('viewer')).send({ name: 'v', teamId: f.teamId }).expect(403);
    await request(app).post('/api/projects').set(auth('member')).send({ name: 'ok', teamId: f.teamId }).expect(201);
  });

  it('role management: only ADMIN/OWNER, cannot demote owner', async () => {
    await request(app).patch(`/api/teams/${f.teamId}/members/${f.viewer}`).set(auth('member')).send({ role: 'ADMIN' }).expect(403);
    await request(app).patch(`/api/teams/${f.teamId}/members/${f.owner}`).set(auth('admin')).send({ role: 'VIEWER' }).expect(400);
    await request(app).patch(`/api/teams/${f.teamId}/members/${f.member}`).set(auth('admin')).send({ role: 'VIEWER' }).expect(200);
    await request(app).patch(`/api/teams/${f.teamId}/members/${f.member}`).set(auth('admin')).send({ role: 'MEMBER' }).expect(200);
  });

  it('ADMIN can delete a project', async () => {
    const p = await prisma.project.create({ data: { name: 'to-delete', teamId: f.teamId } });
    await request(app).delete(`/api/projects/${p.id}`).set(auth('admin')).expect(200);
    expect(await prisma.project.findUnique({ where: { id: p.id } })).toBeNull();
  });

  it('host-execution endpoints are gone', async () => {
    await request(app).post('/api/compile').send({ code: 'console.log(1)', fileType: 'js' }).expect(404);
    await request(app).get('/api/terminal/status').expect(404);
  });
});

describe('T3 Socket.IO authentication & authorization', () => {
  let port: number;
  let close: () => Promise<void>;
  const sockets: Socket[] = [];
  const connect = (token?: string) => {
    const s = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], auth: token ? { token } : {}, reconnection: false });
    sockets.push(s);
    return s;
  };

  beforeAll(async () => {
    const started = await startServer(0);
    port = started.port;
    close = started.close;
  });
  afterAll(async () => {
    sockets.forEach(s => s.close());
    await close();
  });

  it('rejects a socket without a valid token', async () => {
    for (const s of [connect(), connect('bad-token')]) {
      const err = await new Promise<Error>(resolve => s.on('connect_error', resolve));
      expect(err.message).toBe('unauthorized');
    }
  });

  it('a plain authenticated connection spawns no host shell (S1 regression)', async () => {
    const s = connect(tok.member);
    await new Promise<void>(r => s.on('connect', () => r()));
    await new Promise(r => setTimeout(r, 300));
    let children = '';
    // execFileSync (no shell): execSync would itself spawn `sh -c`, which pgrep -P lists on Linux.
    try { children = execFileSync('pgrep', ['-P', String(process.pid), '-l']).toString(); } catch { /* no children */ }
    expect(children).not.toMatch(/bash|cmd\.exe|sh\b/);
  });

  it('outsider cannot join a project room or receive its files; spoofed userId is ignored', async () => {
    const s = connect(tok.outsider);
    await new Promise<void>(r => s.on('connect', () => r()));
    const errors: any[] = [];
    let gotFiles = false;
    s.on('error', e => errors.push(e));
    s.on('filesUpdate', () => { gotFiles = true; });
    s.emit('joinProject', { projectId: f.projectId, userId: f.owner }); // spoof attempt
    await waitFor(() => errors.length > 0);
    expect(errors[0].message).toBe('Forbidden');
    await new Promise(r => setTimeout(r, 200));
    expect(gotFiles).toBe(false);
  });

  it('member joins and receives files with ids; viewer cannot create files', async () => {
    const m = connect(tok.member);
    await new Promise<void>(r => m.on('connect', () => r()));
    const files = new Promise<any>(r => m.once('filesUpdate', r));
    m.emit('joinProject', { projectId: f.projectId });
    const payload = await files;
    expect(payload.files.find((x: any) => x.id === f.fileId)?.path).toBe('main.js');

    const v = connect(tok.viewer);
    await new Promise<void>(r => v.on('connect', () => r()));
    const err = new Promise<any>(r => v.once('error', r));
    v.emit('createFile', { projectId: f.projectId, filename: 'viewer.js', content: 'x' });
    expect((await err).message).toBe('Forbidden');
    expect(await prisma.file.findFirst({ where: { projectId: f.projectId, name: 'viewer.js' } })).toBeNull();
  });

  it('chat sender identity comes from the token, not the payload', async () => {
    const a = connect(tok.member);
    const b = connect(tok.admin);
    await Promise.all([new Promise<void>(r => a.on('connect', () => r())), new Promise<void>(r => b.on('connect', () => r()))]);
    b.emit('joinChat', { recipientId: f.member });
    a.emit('joinChat', { recipientId: f.admin });
    await new Promise(r => setTimeout(r, 200));
    const received = new Promise<any>(r => b.once('newMessage', r));
    a.emit('sendMessage', { senderId: f.owner, recipientId: f.admin, content: 'hi', type: 'text' });
    expect((await received).senderId).toBe(f.member);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
