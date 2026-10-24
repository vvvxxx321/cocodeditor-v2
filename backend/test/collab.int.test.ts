/**
 * Tier T3: real Hocuspocus server + real WebSocket clients + real PostgreSQL.
 * Convergence is asserted on final text (Y.Text.toString()), not on binary encodings.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { Hocuspocus } from '@hocuspocus/server';
import { prisma } from '../src/database/prismaClient';
import { createCollabServer } from '../src/collab/server';
import { fetchState, TEXT_NAME } from '../src/collab/persistence';
import { resetDb, seedFixture, signToken, waitFor, Fixture } from './helpers';
import { connectClient, synced, converged, TestClient } from './collabHelpers';

let f: Fixture;
let server: Hocuspocus;
let port: number;
let url: string;
const tok: Record<string, string> = {};
let clients: TestClient[] = [];
const client = (fileId: string, who: string) => {
  const c = connectClient(url, fileId, tok[who]);
  clients.push(c);
  return c;
};
const STORE_DEBOUNCE = 300;

async function startCollab(atPort = 0) {
  server = createCollabServer({ port: atPort, debounce: STORE_DEBOUNCE, maxDebounce: 1000 });
  await server.listen();
  port = server.address.port;
  url = `ws://127.0.0.1:${port}`;
}

beforeAll(async () => {
  await resetDb();
  f = await seedFixture('hello\n');
  for (const who of ['owner', 'admin', 'member', 'viewer', 'outsider'] as const) tok[who] = await signToken(f[who]);
  await startCollab();
});

beforeEach(() => {
  clients.forEach(c => c.destroy());
  clients = [];
});

afterAll(async () => {
  clients.forEach(c => c.destroy());
  await server.destroy();
  await prisma.$disconnect();
});

const newFile = (content = '') =>
  prisma.file.create({ data: { name: `f-${Math.random().toString(36).slice(2)}.js`, content, projectId: f.projectId } });

describe('T3 collab authorization', () => {
  it('rejects an invalid token and a non-member', async () => {
    const bad = connectClient(url, f.fileId, 'not-a-jwt');
    const outsider = client(f.fileId, 'outsider');
    clients.push(bad);
    await waitFor(() => !!bad.authFailed() && !!outsider.authFailed());
    expect(outsider.provider.isSynced).toBe(false);
    expect(outsider.text.toString()).toBe(''); // received no document content
  });

  it('VIEWER is read-only: edits are neither applied for others nor persisted', async () => {
    const file = await newFile('base');
    const member = client(file.id, 'member');
    const viewer = client(file.id, 'viewer');
    await Promise.all([synced(member), synced(viewer)]);
    expect(viewer.text.toString()).toBe('base');

    viewer.text.insert(0, 'VIEWER-EDIT ');
    member.text.insert(4, '+member');
    await waitFor(() => viewer.text.toString().includes('+member'));
    await new Promise(r => setTimeout(r, STORE_DEBOUNCE * 3));
    expect(member.text.toString()).toBe('base+member');
    const row = await prisma.file.findUnique({ where: { id: file.id } });
    expect(row?.content).toBe('base+member');
  });
});

describe('T3 concurrent editing', () => {
  it('two clients inserting at the same offset concurrently converge with both inserts', async () => {
    const file = await newFile('0123456789');
    const a = client(file.id, 'member');
    const b = client(file.id, 'admin');
    await Promise.all([synced(a), synced(b)]);
    // Both edits are made before either has seen the other's.
    a.text.insert(5, 'AAA');
    b.text.insert(5, 'BBB');
    await converged([a, b]);
    const final = a.text.toString();
    expect(final).toContain('AAA');
    expect(final).toContain('BBB');
    expect(final.length).toBe(16);
    expect(final.startsWith('01234') && final.endsWith('56789')).toBe(true);
  });

  it('three clients x 200 random insert/delete ops converge to identical text', async () => {
    const file = await newFile('seed text for random edits\n');
    const cs = [client(file.id, 'member'), client(file.id, 'admin'), client(file.id, 'owner')];
    await Promise.all(cs.map(c => synced(c)));
    let seed = 42;
    const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % Math.max(n, 1); };
    for (let i = 0; i < 200; i++) {
      for (const c of cs) {
        const len = c.text.length;
        if (len > 0 && rand(3) === 0) c.text.delete(rand(len), Math.min(1 + rand(3), len));
        else c.text.insert(rand(len + 1), String.fromCharCode(97 + rand(26)));
      }
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 5));
    }
    await converged(cs, 10000);
    expect(new Set(cs.map(c => c.text.toString())).size).toBe(1);
  });

  it('offline edits merge after reconnect', async () => {
    const file = await newFile('line1\n');
    const a = client(file.id, 'member');
    const b = client(file.id, 'admin');
    await Promise.all([synced(a), synced(b)]);
    a.provider.disconnect();
    a.text.insert(a.text.length, 'offline-A\n');
    b.text.insert(0, 'online-B\n');
    await new Promise(r => setTimeout(r, 200));
    expect(b.text.toString()).not.toContain('offline-A');
    await a.provider.connect();
    await converged([a, b]);
    expect(a.text.toString()).toContain('offline-A');
    expect(a.text.toString()).toContain('online-B');
  });
});

describe('T3 durability', () => {
  it('persists CRDT state + materialized File.content and restores them after a server restart', async () => {
    const file = await newFile('');
    const a = client(file.id, 'member');
    await synced(a);
    a.text.insert(0, 'durable content');
    await waitFor(async () => (await prisma.file.findUnique({ where: { id: file.id } }))?.content === 'durable content', 5000);
    a.destroy();

    const oldPort = port;
    await server.destroy();
    await startCollab(oldPort);

    const b = client(file.id, 'admin');
    await synced(b);
    expect(b.text.toString()).toBe('durable content');
    const row = await prisma.fileDocument.findUnique({ where: { fileId: file.id } });
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(row!.state));
    expect(restored.getText(TEXT_NAME).toString()).toBe('durable content');
  });

  it('connected clients reconnect after a server restart and keep editing', async () => {
    const file = await newFile('x');
    const a = client(file.id, 'member');
    const b = client(file.id, 'admin');
    await Promise.all([synced(a), synced(b)]);
    a.text.insert(1, 'y');
    await converged([a, b]);
    await waitFor(async () => (await prisma.file.findUnique({ where: { id: file.id } }))?.content === 'xy');

    const oldPort = port;
    await server.destroy(); // graceful: flushes pending stores
    await startCollab(oldPort);
    // Edit while the clients are reconnecting.
    b.text.insert(0, 'z');
    await waitFor(() => a.text.toString() === 'zxy', 10000);
    await converged([a, b]);
  });
});

describe('T3 V1 -> V2 bootstrap', () => {
  it('bootstraps from File.content exactly once under concurrent loads (no duplicated text)', async () => {
    const file = await newFile('legacy V1 content');
    const states = await Promise.all(Array.from({ length: 5 }, () => fetchState(file.id)));
    expect(await prisma.fileDocument.count({ where: { fileId: file.id } })).toBe(1);
    // Every loader returns the single stored state.
    const merged = new Y.Doc();
    states.forEach(s => Y.applyUpdate(merged, s!));
    expect(merged.getText(TEXT_NAME).toString()).toBe('legacy V1 content');
  });

  it('two clients opening an un-migrated file at once see it once', async () => {
    const file = await newFile('only once');
    const a = client(file.id, 'member');
    const b = client(file.id, 'admin');
    await Promise.all([synced(a), synced(b)]);
    await converged([a, b]);
    expect(a.text.toString()).toBe('only once');
  });

  it('a client holding bootstrapped state does not duplicate text after a server restart', async () => {
    // Failure mode guarded against: if bootstrap state were not persisted, a reload would build a
    // second, independent initial insert, and the reconnecting client would merge both copies.
    const file = await newFile('only once');
    const a = client(file.id, 'member');
    await synced(a);
    const oldPort = port;
    await server.destroy();
    await startCollab(oldPort);
    const b = client(file.id, 'admin');
    await synced(b);
    await waitFor(() => a.provider.isSynced, 10000);
    await new Promise(r => setTimeout(r, 200));
    await converged([a, b]);
    expect(a.text.toString()).toBe('only once');
  });
});
