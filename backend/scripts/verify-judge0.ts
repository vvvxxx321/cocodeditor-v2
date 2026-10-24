/**
 * Tier T4: real Judge0 end-to-end through the V2 pipeline:
 *   HTTP API (POST /api/executions) -> Postgres row -> BullMQ (Redis) -> worker -> Judge0 -> poll API.
 * Uses the DEV database and backend/.env. Requires JUDGE0_API_KEY (RapidAPI) or JUDGE0_AUTH_TOKEN.
 * Usage: npx tsx scripts/verify-judge0.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import { SignJWT } from 'jose';

async function main() {
  if (!process.env.JUDGE0_API_KEY && !process.env.JUDGE0_AUTH_TOKEN) {
    console.log('SKIPPED: no JUDGE0_API_KEY / JUDGE0_AUTH_TOKEN in backend/.env; real Judge0 NOT verified.');
    process.exit(2);
  }
  if (!process.env.SUPABASE_JWT_SECRET) throw new Error('SUPABASE_JWT_SECRET (local dev secret) is required to mint a dev token');
  const { prisma } = await import('../src/database/prismaClient');
  const { startServer } = await import('../src/index');
  const { createExecutionWorker } = await import('../src/worker/executionWorker');
  const { closeExecutionQueue } = await import('../src/queue/executionQueue');

  const userId = randomUUID();
  await prisma.profile.create({ data: { id: userId, email: `judge0-verify-${userId}@test.local`, name: 'judge0-verify' } });
  const team = await prisma.team.create({ data: { name: `judge0-verify-${Date.now()}`, ownerId: userId } });
  await prisma.teamMember.create({ data: { teamId: team.id, profileId: userId, role: 'ADMIN' } });
  const project = await prisma.project.create({ data: { name: 'judge0-verify', teamId: team.id } });
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setAudience('authenticated')
    .setExpirationTime('10m').sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));

  const { server, io, port } = await startServer(0);
  const worker = createExecutionWorker();
  const cases = [
    { name: 'python hello', language: 'python', code: 'print("hello from judge0")', expect: (j: any) => j.stdout?.trim() === 'hello from judge0' },
    { name: 'python stdin', language: 'python', code: 'print(int(input()) * 2)', stdin: '21', expect: (j: any) => j.stdout?.trim() === '42' },
    { name: 'cpp hello', language: 'cpp', code: '#include <iostream>\nint main(){std::cout<<"cpp ok"<<std::endl;}', expect: (j: any) => j.stdout?.trim() === 'cpp ok' },
    { name: 'java hello', language: 'java', code: 'public class Main { public static void main(String[] a){ System.out.println("java ok"); } }', expect: (j: any) => j.stdout?.trim() === 'java ok' },
    { name: 'cpp compile error', language: 'cpp', code: 'int main( { return 0; }', expect: (j: any) => j.statusDescription === 'Compilation Error' },
  ];
  let failures = 0;
  for (const c of cases) {
    const started = Date.now();
    const res = await fetch(`http://127.0.0.1:${port}/api/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ projectId: project.id, language: c.language, code: c.code, stdin: c.stdin ?? '' }),
    });
    let job: any = await res.json();
    while (!['SUCCEEDED', 'FAILED', 'TIMED_OUT'].includes(job.status) && Date.now() - started < 60000) {
      await new Promise(r => setTimeout(r, 500));
      job = await (await fetch(`http://127.0.0.1:${port}/api/executions/${job.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    }
    const pass = job.status === 'SUCCEEDED' && c.expect(job);
    if (!pass) failures++;
    console.log(JSON.stringify({
      case: c.name, pass, httpStatus: res.status, status: job.status, judge0Status: job.statusDescription, attempts: job.attempts,
      stdout: job.stdout, compileOutput: job.compileOutput?.slice(0, 200), error: job.error, judge0TimeMs: job.timeMs,
      memoryKb: job.memoryKb, endToEndMs: Date.now() - started,
    }));
  }
  await worker.close();
  await closeExecutionQueue();
  io.close();
  server.close();
  await prisma.$disconnect();
  console.log(failures ? `FAILED: ${failures}/${cases.length}` : `PASSED: ${cases.length}/${cases.length}`);
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error('ERROR', err.message); process.exit(1); });
