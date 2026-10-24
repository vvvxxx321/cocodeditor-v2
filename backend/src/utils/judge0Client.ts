import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Judge0 HTTP client (RapidAPI-hosted CE or self-hosted). Called only by the execution worker.
 * Errors are classified so the queue knows whether a retry can help.
 */
export class RetryableError extends Error {}
export class PermanentError extends Error {}

// Map of language names to Judge0 language IDs
// Reference: https://api.judge0.com/languages/
export const LANGUAGE_ID_MAP: Record<string, number> = {
  'c': 50,        // C (GCC 9.2.0)
  'cpp': 54,      // C++ (GCC 9.2.0)
  'java': 62,     // Java (OpenJDK 13.0.1)
  'python': 71,   // Python (3.8.1)
  'javascript': 63, // JavaScript (Node.js 12.14.0)
  'typescript': 74, // TypeScript (3.7.4)
  'go': 60,       // Go (1.13.5)
  'rust': 73,     // Rust (1.40.0)
  'ruby': 72,     // Ruby (2.7.0)
  'php': 68,      // PHP (7.4.1)
  'csharp': 51,   // C# (Mono 6.6.0.161)
  'kotlin': 78,   // Kotlin (1.3.70)
  'swift': 83,    // Swift (5.2.3)
};

/**
 * Get Judge0 language ID from language name
 */
export function getLanguageId(language: string): number {
  const languageId = LANGUAGE_ID_MAP[language.toLowerCase()];
  if (!languageId) {
    throw new PermanentError(`Unsupported language: ${language}`);
  }
  return languageId;
}

// Status codes: https://ce.judge0.com/#statuses-and-specifications
export const STATUS_DESCRIPTIONS: Record<number, string> = {
  1: 'In Queue',
  2: 'Processing',
  3: 'Accepted',
  4: 'Wrong Answer',
  5: 'Time Limit Exceeded',
  6: 'Compilation Error',
  7: 'Runtime Error (SIGSEGV)',
  8: 'Runtime Error (SIGXFSZ)',
  9: 'Runtime Error (SIGFPE)',
  10: 'Runtime Error (SIGABRT)',
  11: 'Runtime Error (NZEC)',
  12: 'Runtime Error (Other)',
  13: 'Internal Error',
  14: 'Exec Format Error'
};

export interface Judge0Result {
  statusId: number;
  statusDescription: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  message: string | null;
  timeMs: number | null;
  memoryKb: number | null;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string | null | undefined) => (s == null ? null : Buffer.from(s, 'base64').toString('utf8'));

function client(): AxiosInstance {
  const baseURL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = process.env.JUDGE0_API_HOST || new URL(baseURL).host;
  }
  if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  return axios.create({ baseURL, headers, timeout: Number(process.env.JUDGE0_HTTP_TIMEOUT_MS || 10000) });
}

function classify(err: unknown, op: string): Error {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<any>;
    const status = e.response?.status;
    if (!status) return new RetryableError(`${op}: network error (${e.code || e.message})`);
    if (status === 429 || status >= 500) return new RetryableError(`${op}: Judge0 responded ${status}`);
    return new PermanentError(`${op}: Judge0 responded ${status}: ${JSON.stringify(e.response?.data ?? '').slice(0, 300)}`);
  }
  return err as Error;
}

/** Create a submission without waiting; returns the Judge0 token. */
export async function submit(sourceCode: string, language: string, stdin = '', limits = { cpuTimeLimit: 5, memoryLimitKb: 256000 }): Promise<string> {
  const languageId = getLanguageId(language);
  try {
    const res = await client().post('/submissions', {
      source_code: b64(sourceCode),
      language_id: languageId,
      stdin: b64(stdin),
      cpu_time_limit: limits.cpuTimeLimit,
      memory_limit: limits.memoryLimitKb,
    }, { params: { base64_encoded: 'true', wait: 'false' } });
    if (!res.data?.token) throw new RetryableError('submit: Judge0 response had no token');
    return res.data.token;
  } catch (err) {
    throw classify(err, 'submit');
  }
}

export async function getSubmission(token: string): Promise<Judge0Result> {
  try {
    const res = await client().get(`/submissions/${encodeURIComponent(token)}`, {
      params: { base64_encoded: 'true', fields: 'status,stdout,stderr,compile_output,message,time,memory' },
    });
    const d = res.data;
    return {
      statusId: d.status?.id,
      statusDescription: STATUS_DESCRIPTIONS[d.status?.id] || d.status?.description || 'Unknown',
      stdout: unb64(d.stdout),
      stderr: unb64(d.stderr),
      compileOutput: unb64(d.compile_output),
      message: unb64(d.message),
      timeMs: d.time != null ? Math.round(Number(d.time) * 1000) : null,
      memoryKb: d.memory ?? null,
    };
  } catch (err) {
    throw classify(err, 'getSubmission');
  }
}

export const isPending = (statusId: number) => statusId === 1 || statusId === 2;
