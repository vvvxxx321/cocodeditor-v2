import { v4 as uuidv4 } from 'uuid';

/**
 * V2 queued execution: POST /api/executions (Idempotency-Key per click), then poll until the job
 * is terminal. Returns `{ ok, data }` where `data` keeps the V1 response shape used by the UI
 * (stdout/stderr/compile_output/error/execution_time in ms/memory in KB).
 */
const TERMINAL = ['SUCCEEDED', 'FAILED', 'TIMED_OUT'];

export interface RunParams {
  projectId: string;
  fileId?: string;
  language: string;
  code: string;
  stdin: string;
  accessToken?: string;
}

export async function runQueuedExecution(p: RunParams, opts = { pollMs: 500, maxWaitMs: 60000 }) {
  const key = uuidv4();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.accessToken}`, 'Idempotency-Key': key };
  const body = JSON.stringify({ projectId: p.projectId, fileId: p.fileId, language: p.language, code: p.code, stdin: p.stdin });

  // Retry the POST with the SAME key if the queue is temporarily unavailable (503).
  let job: any;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('/api/executions', { method: 'POST', headers, body });
    job = await res.json().catch(() => ({}));
    if (res.ok) break;
    if (res.status !== 503 || attempt >= 3) return { ok: false, data: { error: job.error || `Execution request failed (${res.status})` } };
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }

  const started = Date.now();
  while (!TERMINAL.includes(job.status)) {
    if (Date.now() - started > opts.maxWaitMs) return { ok: false, data: { error: 'Timed out waiting for the execution result' } };
    await new Promise(r => setTimeout(r, opts.pollMs));
    const res = await fetch(`/api/executions/${job.id}`, { headers: { Authorization: `Bearer ${p.accessToken}` } });
    if (res.ok) job = await res.json();
  }

  let error: string | null = null;
  if (job.status !== 'SUCCEEDED') error = job.error || `Execution ${job.status.toLowerCase()}`;
  else if (job.statusDescription === 'Compilation Error') error = `Compilation Error: ${job.compileOutput || 'Unknown compilation error'}`;
  else if (job.statusDescription?.startsWith('Runtime Error')) error = `${job.statusDescription}${job.stderr ? '\n' + job.stderr : ''}`;
  else if (job.statusDescription === 'Time Limit Exceeded') error = 'Time Limit Exceeded: Your code took too long to execute';

  return {
    ok: true,
    data: {
      executionId: job.id,
      stdout: job.stdout, stderr: job.stderr, compile_output: job.compileOutput,
      execution_time: job.timeMs, memory: job.memoryKb, error,
    },
  };
}
