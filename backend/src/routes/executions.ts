import express, { NextFunction, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { can, getProjectAccess } from '../auth/rbac';
import { prisma } from '../database/prismaClient';
import { LANGUAGE_ID_MAP } from '../utils/judge0Client';
import { IdempotencyConflictError, submitExecution, toView } from '../services/executionService';

/**
 * Asynchronous code execution: POST enqueues and returns 202; clients poll GET /:id.
 * Replaces V1's synchronous /api/execute (request thread blocked while polling Judge0).
 */
const router = express.Router();
const MAX_SOURCE_BYTES = 64 * 1024;
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

router.post('/', authenticate, wrap(async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key || key.length > 128) return void res.status(400).json({ error: 'Idempotency-Key header (1-128 chars) is required' });
  const { projectId, fileId, language, code, stdin } = req.body ?? {};
  if (!projectId || typeof code !== 'string' || typeof language !== 'string') {
    return void res.status(400).json({ error: 'projectId, language and code are required' });
  }
  if (!LANGUAGE_ID_MAP[language.toLowerCase()]) return void res.status(400).json({ error: `Unsupported language: ${language}` });
  if (Buffer.byteLength(code, 'utf8') > MAX_SOURCE_BYTES) return void res.status(413).json({ error: 'Source code too large' });

  const access = await getProjectAccess(req.user.id, String(projectId));
  if (!access) return void res.status(404).json({ error: 'Not found' });
  if (!can(access.role, 'run')) return void res.status(403).json({ error: 'Forbidden' });
  if (fileId) {
    const file = await prisma.file.findFirst({ where: { id: String(fileId), projectId: access.projectId }, select: { id: true } });
    if (!file) return void res.status(404).json({ error: 'File not found in project' });
  }

  try {
    const { job, created, enqueueError } = await submitExecution({
      userId: req.user.id, projectId: access.projectId, fileId: fileId ?? null, idempotencyKey: key,
      language: language.toLowerCase(), sourceCode: code, stdin: typeof stdin === 'string' ? stdin : '',
    });
    if (enqueueError) {
      res.setHeader('Retry-After', '2');
      return void res.status(503).json({ ...toView(job), error: 'Execution queue unavailable; retry with the same Idempotency-Key' });
    }
    res.status(created ? 202 : 200).json(toView(job));
  } catch (err) {
    if (err instanceof IdempotencyConflictError) return void res.status(409).json({ error: err.message });
    throw err;
  }
}));

router.get('/:id', authenticate, wrap(async (req, res) => {
  const job = await prisma.executionJob.findUnique({ where: { id: req.params.id } });
  if (!job) return void res.status(404).json({ error: 'Not found' });
  if (job.userId !== req.user.id) {
    const access = await getProjectAccess(req.user.id, job.projectId);
    if (!access || !can(access.role, 'read')) return void res.status(404).json({ error: 'Not found' });
  }
  res.json(toView(job));
}));

router.get('/', authenticate, wrap(async (req, res) => {
  const projectId = String(req.query.projectId || '');
  const access = projectId ? await getProjectAccess(req.user.id, projectId) : null;
  if (!access) return void res.status(404).json({ error: 'Not found' });
  const jobs = await prisma.executionJob.findMany({
    where: { projectId, userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 20,
  });
  res.json(jobs.map(toView));
}));

export default router;
