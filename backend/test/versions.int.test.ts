/**
 * Tier T3: real Hocuspocus + real WebSocket clients + real PostgreSQL + API (supertest).
 * Snapshot/restore must reflect the LIVE Yjs document, not debounced File.content.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import * as Y from 'yjs';
import { Hocuspocus } from '@hocuspocus/server';
import { prisma } from '../src/database/prismaClient';
import { createApp } from '../src/index';
import { createCollabServer } from '../src/collab/server';
import { storeState, TEXT_NAME } from '../src/collab/persistence';
import { maybeAutoSnapshot } from '../src/collab/versionOps';
import { resetDb, seedFixture, signToken, waitFor, Fixture } from './helpers';
import { connectClient, synced, converged, TestClient } from './collabHelpers';

const app = createApp();
let f: Fixture;
let server: Hocuspocus;
let url: string;
const tok: Record<string, string> = {};
const auth = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });
let clients: TestClient[] = [];
const client = (fileId: string, who: string) => {
  const c = connectClient(url, fileId, tok[who]);
  clients.push(c);
  return c;
};
// Long debounce on purpose: File.content stays stale for seconds after an edit.
const STORE_DEBOUNCE = 3000;

beforeAll(async () => {
  await resetDb();
  f = await seedFixture();
  for (const who of ['owner', 'admin', 'member', 'viewer', 'outsider'] as const) tok[who] = await signToken(f[who]);
  server = createCollabServer({ port: 0, debounce: STORE_DEBOUNCE, maxDebounce: 10000, autoSnapshotIntervalMs: Infinity });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
  process.env.COLLAB_INTERNAL_URL = `http://127.0.0.1:${server.address.port}`;
});
beforeEach(() => { clients.forEach(c => c.destroy()); clients = []; });
afterAll(async () => {
  clients.forEach(c => c.destroy());
  await server.destroy();
  await prisma.$disconnect();
});

const newFile = (content = '') =>
  prisma.file.create({ data: { name: `v-${Math.random().toString(36).slice(2)}.js`, content, projectId: f.projectId } });
const fileContent = async (id: string) => (await prisma.file.findUnique({ where: { id } }))!.content;
const snap = (fileId: string, who = 'member') => request(app).post(`/api/files/${fileId}/versions`).set(auth(who));
const restoreV = (fileId: string, versionId: string, who = 'member') =>
  request(app).post(`/api/files/${fileId}/versions/${versionId}/restore`).set(auth(who));

describe('T3 version history API', () => {
  it('numbers snapshots sequentially and lists newest first without content', async () => {
    const file = await newFile('a');
    const v1 = (await snap(file.id).expect(201)).body;
    const v2 = (await snap(file.id).expect(201)).body;
    expect([v1.versionNumber, v2.versionNumber]).toEqual([1, 2]);
    const list = (await request(app).get(`/api/files/${file.id}/versions`).set(auth('member')).expect(200)).body;
    expect(list.map((v: any) => v.versionNumber)).toEqual([2, 1]);
    expect(list[0].content).toBeUndefined();
    const one = (await request(app).get(`/api/files/${file.id}/versions/${v1.id}`).set(auth('viewer')).expect(200)).body;
    expect(one.content).toBe('a');
    expect(one.reason).toBe('MANUAL');
  });

  it('20 concurrent snapshots get unique, gap-free numbers', async () => {
    const file = await newFile('c');
    const res = await Promise.all(Array.from({ length: 20 }, () => snap(file.id)));
    expect(res.every(r => r.status === 201)).toBe(true);
    const nums = res.map(r => r.body.versionNumber).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('RBAC: outsider 404, viewer may list but not snapshot/restore', async () => {
    const file = await newFile('r');
    const v = (await snap(file.id).expect(201)).body;
    await request(app).get(`/api/files/${file.id}/versions`).set(auth('outsider')).expect(404);
    await request(app).get(`/api/files/${file.id}/versions`).set(auth('viewer')).expect(200);
    await snap(file.id, 'viewer').expect(403);
    await restoreV(file.id, v.id, 'viewer').expect(403);
    await restoreV(file.id, v.id, 'outsider').expect(404);
    // a version id from another file is not restorable through this file
    const other = await newFile('o');
    const ov = (await snap(other.id).expect(201)).body;
    await restoreV(file.id, ov.id).expect(404);
  });
});

describe('T3 live restore', () => {
  it('restoring updates every connected client; editing continues and converges', async () => {
    const file = await newFile('version one');
    const a = client(file.id, 'member');
    const b = client(file.id, 'admin');
    await Promise.all([synced(a), synced(b)]);
    const v1 = (await snap(file.id).expect(201)).body;

    a.text.delete(0, a.text.length);
    a.text.insert(0, 'version two');
    await waitFor(() => b.text.toString() === 'version two');

    const r = (await restoreV(file.id, v1.id).expect(200)).body;
    expect(r.restoredFrom).toBe(1);
    await waitFor(() => a.text.toString() === 'version one' && b.text.toString() === 'version one');
    expect(await fileContent(file.id)).toBe('version one'); // persisted immediately, not after debounce

    b.text.insert(b.text.length, ' + edit after restore');
    await converged([a, b]);
    expect(a.text.toString()).toBe('version one + edit after restore');
  });

  it('restore of a document nobody has open persists to FileDocument and File.content', async () => {
    const file = await newFile('original');
    const v1 = (await snap(file.id).expect(201)).body;
    await prisma.file.update({ where: { id: file.id }, data: { content: 'ignored' } }); // not the source of truth
    const a = client(file.id, 'member');
    await synced(a);
    a.text.insert(0, 'changed ');
    await waitFor(async () => (await fileContent(file.id)) === 'changed original', STORE_DEBOUNCE + 3000);
    a.destroy();
    await waitFor(() => server.getDocumentsCount() === 0, 5000);

    await restoreV(file.id, v1.id).expect(200);
    expect(await fileContent(file.id)).toBe('original');
    const row = await prisma.fileDocument.findUnique({ where: { fileId: file.id } });
    const d = new Y.Doc();
    Y.applyUpdate(d, new Uint8Array(row!.state));
    expect(d.getText(TEXT_NAME).toString()).toBe('original');
  });
});

describe('T3 stale-persistence race (snapshot source = live doc)', () => {
  it('manual snapshot and PRE_RESTORE capture text that File.content does not have yet', async () => {
    const file = await newFile('base');
    const a = client(file.id, 'member');
    const observer = client(file.id, 'admin');
    await Promise.all([synced(a), synced(observer)]);
    const v1 = (await snap(file.id).expect(201)).body; // persists 'base'

    a.text.insert(a.text.length, ' latest-1');
    await waitFor(() => observer.text.toString() === 'base latest-1'); // server has the update
    expect(await fileContent(file.id)).toBe('base'); // the race exists: DB is stale (debounce 3s)

    const s = (await snap(file.id).expect(201)).body;
    expect((await request(app).get(`/api/files/${file.id}/versions/${s.id}`).set(auth('member'))).body.content).toBe('base latest-1');

    a.text.insert(a.text.length, ' latest-2');
    await waitFor(() => observer.text.toString() === 'base latest-1 latest-2');
    expect(await fileContent(file.id)).toBe('base latest-1'); // stale again

    const r = (await restoreV(file.id, v1.id).expect(200)).body;
    expect(r.preRestore.reason).toBe('PRE_RESTORE');
    expect(r.preRestore.content).toBe('base latest-1 latest-2');
    expect(r.restored.content).toBe('base');
    await waitFor(() => a.text.toString() === 'base');
  });

  it('concurrent snapshot + restore on one document are serialized (unique numbers, whole PRE_RESTORE)', async () => {
    const file = await newFile('start');
    const a = client(file.id, 'member');
    await synced(a);
    const v1 = (await snap(file.id).expect(201)).body;
    a.text.insert(a.text.length, ' more');
    await new Promise(r => setTimeout(r, 100));
    const results = await Promise.all([
      snap(file.id), restoreV(file.id, v1.id), snap(file.id), restoreV(file.id, v1.id), snap(file.id),
    ]);
    expect(results.every(r => r.status < 300)).toBe(true);
    const versions = await prisma.fileVersion.findMany({ where: { fileId: file.id }, orderBy: { versionNumber: 'asc' } });
    const nums = versions.map(v => v.versionNumber);
    expect(new Set(nums).size).toBe(nums.length);
    expect(nums).toEqual(Array.from({ length: nums.length }, (_, i) => i + 1));
    for (const v of versions.filter(v => v.reason === 'PRE_RESTORE')) expect(['start more', 'start']).toContain(v.content);
  });
});

describe('T3 persistence safety', () => {
  it('merge-on-write: an older in-memory state cannot regress the stored document', async () => {
    const file = await newFile('');
    const newer = new Y.Doc();
    newer.getText(TEXT_NAME).insert(0, 'hello');
    const older = new Y.Doc();
    Y.applyUpdate(older, Y.encodeStateAsUpdate(newer)); // older = 'hello'
    newer.getText(TEXT_NAME).insert(5, ' world');        // newer = 'hello world'
    await storeState(file.id, newer);
    await storeState(file.id, older); // a slow store with stale state commits last
    expect(await fileContent(file.id)).toBe('hello world');
  });

  it('AUTO snapshot only when content changed and the interval elapsed', async () => {
    const file = await newFile('');
    expect(await maybeAutoSnapshot(file.id, 'x', new Uint8Array(), 60_000)).not.toBeNull(); // first version
    expect(await maybeAutoSnapshot(file.id, 'y', new Uint8Array(), 60_000)).toBeNull();     // too soon
    expect(await maybeAutoSnapshot(file.id, 'y', new Uint8Array(), 0)).not.toBeNull();      // interval elapsed
    expect(await maybeAutoSnapshot(file.id, 'y', new Uint8Array(), 0)).toBeNull();          // unchanged
  });

  it('returns 503 (no stale fallback) when the collab server is unreachable', async () => {
    const file = await newFile('z');
    const saved = process.env.COLLAB_INTERNAL_URL;
    process.env.COLLAB_INTERNAL_URL = 'http://127.0.0.1:1'; // nothing listens here
    try {
      await snap(file.id).expect(503);
    } finally {
      process.env.COLLAB_INTERNAL_URL = saved;
    }
    expect(await prisma.fileVersion.count({ where: { fileId: file.id } })).toBe(0);
  });
});
