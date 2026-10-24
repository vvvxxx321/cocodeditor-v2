/**
 * Tier T3: two real API processes' worth of Socket.IO servers (two http servers on different
 * ports in this process) sharing one real Redis through @socket.io/redis-adapter.
 * Clients on instance A and instance B must see each other's room events.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient, Socket } from 'socket.io-client';
import { prisma } from '../src/database/prismaClient';
import { startServer } from '../src/index';
import { resetDb, seedFixture, signToken, waitFor, Fixture } from './helpers';
import { TestRedis, freePort } from './fakes/redisServer';

let f: Fixture;
let redis: TestRedis;
const tok: Record<string, string> = {};
const sockets: Socket[] = [];
type Started = Awaited<ReturnType<typeof startServer>>;

const connect = async (port: number, who: string) => {
  const s = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], auth: { token: tok[who] }, reconnection: false });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => { s.on('connect', () => resolve()); s.on('connect_error', reject); });
  return s;
};
const collect = (s: Socket, event: string) => {
  const got: any[] = [];
  s.on(event, (p: any) => got.push(p));
  return got;
};
const joinProject = async (s: Socket, projectId: string) => {
  const files = new Promise(r => s.once('filesUpdate', r));
  s.emit('joinProject', { projectId });
  await files;
};

beforeAll(async () => {
  await resetDb();
  f = await seedFixture();
  for (const who of ['member', 'admin', 'owner'] as const) tok[who] = await signToken(f[who]);
  redis = new TestRedis(await freePort());
  await redis.start();
  process.env.REDIS_URL = redis.url;
});
afterAll(async () => {
  sockets.forEach(s => s.close());
  await redis.stop();
  await prisma.$disconnect();
});

describe('T3 Socket.IO across two instances (Redis adapter ON)', () => {
  let a: Started, b: Started;
  beforeAll(async () => {
    delete process.env.SOCKET_REDIS_ADAPTER;
    [a, b] = await Promise.all([startServer(0), startServer(0)]);
  });
  afterAll(async () => { await Promise.all([a.close(), b.close()]); });

  it('file creation on instance A reaches a client on instance B', async () => {
    const onA = await connect(a.port, 'member');
    const onB = await connect(b.port, 'admin');
    await joinProject(onA, f.projectId);
    await joinProject(onB, f.projectId);
    const created = collect(onB, 'fileCreated');
    onA.emit('createFile', { projectId: f.projectId, filename: 'cross-instance.js', content: '// hi' });
    await waitFor(() => created.length > 0, 5000);
    expect(created[0].path).toBe('cross-instance.js');
    expect(created[0].id).toBeTruthy();
  });

  it('project presence on B lists the user connected to A (fetchSockets across instances)', async () => {
    const onA = await connect(a.port, 'owner');
    const onB = await connect(b.port, 'member');
    const presence = collect(onB, 'projectUsers');
    await joinProject(onB, f.projectId);
    await joinProject(onA, f.projectId);
    await waitFor(() => presence.some(list => list.some((u: any) => u.id === f.owner)), 5000);
    const last = presence[presence.length - 1].map((u: any) => u.id);
    expect(last).toEqual(expect.arrayContaining([f.owner, f.member]));
  });

  it('chat: message from A reaches B, and history is shared through Redis', async () => {
    const onA = await connect(a.port, 'member');
    const onB = await connect(b.port, 'admin');
    onA.emit('joinChat', { recipientId: f.admin });
    onB.emit('joinChat', { recipientId: f.member });
    await new Promise(r => setTimeout(r, 200));
    const received = collect(onB, 'newMessage');
    onA.emit('sendMessage', { recipientId: f.admin, content: 'hello across instances', type: 'text' });
    await waitFor(() => received.length > 0, 5000);
    expect(received[0]).toMatchObject({ senderId: f.member, content: 'hello across instances' });

    // A brand-new socket on instance B gets the history that was written by instance A.
    const later = await connect(b.port, 'admin');
    const history = new Promise<any[]>(r => later.once('chatHistory', r));
    later.emit('joinChat', { recipientId: f.member });
    expect((await history).map(m => m.content)).toContain('hello across instances');
  });

  it('offline status: closing the last socket of a user on A is observed on B; a second socket keeps them online', async () => {
    sockets.splice(0).forEach(s => s.close()); // earlier tests left 'owner' connected
    await new Promise(r => setTimeout(r, 300));
    const watcher = await connect(b.port, 'admin');
    const updates = collect(watcher, 'usersUpdate');
    const s1 = await connect(a.port, 'owner');
    const s2 = await connect(b.port, 'owner');
    s1.close();
    await new Promise(r => setTimeout(r, 500));
    expect(updates.flat().some((u: any) => u.id === f.owner && u.status === 'offline')).toBe(false);
    s2.close();
    await waitFor(() => updates.flat().some((u: any) => u.id === f.owner && u.status === 'offline'), 5000);
  });
});

describe('T3 negative control (Redis adapter OFF)', () => {
  let a: Started, b: Started;
  beforeAll(async () => {
    process.env.SOCKET_REDIS_ADAPTER = 'false';
    [a, b] = await Promise.all([startServer(0), startServer(0)]);
  });
  afterAll(async () => {
    delete process.env.SOCKET_REDIS_ADAPTER;
    await Promise.all([a.close(), b.close()]);
  });

  it('without the adapter, a client on B does NOT receive A\'s room broadcast', async () => {
    const onA = await connect(a.port, 'member');
    const onB = await connect(b.port, 'admin');
    await joinProject(onA, f.projectId);
    await joinProject(onB, f.projectId);
    const created = collect(onB, 'fileCreated');
    const sameInstance = collect(onA, 'fileCreated');
    onA.emit('createFile', { projectId: f.projectId, filename: 'no-adapter.js', content: '' });
    await waitFor(() => sameInstance.length > 0, 5000); // the event was emitted...
    await new Promise(r => setTimeout(r, 500));
    expect(created).toHaveLength(0);                   // ...but never crossed instances
  });
});
