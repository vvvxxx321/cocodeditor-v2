/** Tier T3 (real Postgres + Redis) / T1: health probes, request ids, log redaction. */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { Writable } from 'stream';
import pino from 'pino';
import { createApp } from '../src/index';
import { REDACT } from '../src/logger';
import { prisma } from '../src/database/prismaClient';

const app = createApp();
afterAll(() => prisma.$disconnect());

describe('T3 health probes', () => {
  it('/healthz is a cheap liveness probe', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
  });
  it('/readyz checks Postgres and Redis', async () => {
    const res = await request(app).get('/readyz').expect(200);
    expect(res.body.checks).toEqual({ database: 'ok', redis: 'ok' });
  });
});

describe('T3 request ids', () => {
  it('echoes a caller-supplied X-Request-Id and generates one otherwise', async () => {
    const given = await request(app).get('/healthz').set('X-Request-Id', 'trace-123');
    expect(given.headers['x-request-id']).toBe('trace-123');
    const generated = await request(app).get('/api/projects/x');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('T1 log redaction', () => {
  it('never writes bearer tokens or internal secrets to logs', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const log = pino({ redact: REDACT }, sink);
    log.info({ req: { headers: { authorization: 'Bearer eyJsecret', 'x-internal-secret': 's3cr3t', cookie: 'sb=1' } }, token: 'abc' }, 'request');
    const out = lines.join('');
    expect(out).not.toContain('eyJsecret');
    expect(out).not.toContain('s3cr3t');
    expect(out).not.toContain('"abc"');
    expect(out).toContain('[REDACTED]');
  });
});
