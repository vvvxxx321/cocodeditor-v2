import express, { NextFunction, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireProjectAccess } from '../auth/rbac';
import { versionService } from '../services/versionService';
import { collabClient, CollabUnavailableError } from '../collab/client';

/**
 * File version history. Snapshot/restore are executed by the collab server against the live
 * Yjs document; the API only authenticates, authorizes and forwards. If the collab server is
 * unreachable we return 503 rather than snapshotting possibly-stale File.content.
 */
const router = express.Router({ mergeParams: true });
// Express 4 does not forward rejected promises to the error handler.
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const fileParam = { fileId: ['params', 'fileId'] as ['params', string] };

const forward = async (res: Response, call: () => Promise<{ status: number; data: unknown }>) => {
  try {
    const { status, data } = await call();
    res.status(status).json(data);
  } catch (err) {
    if (err instanceof CollabUnavailableError) {
      res.status(503).json({ error: 'Collaboration service unavailable' });
      return;
    }
    throw err;
  }
};

router.get('/', authenticate, requireProjectAccess('read', fileParam), wrap(async (req, res) => {
  res.json(await versionService.listVersions(req.params.fileId));
}));

router.get('/:versionId', authenticate, requireProjectAccess('read', fileParam), wrap(async (req, res) => {
  const version = await versionService.getVersion(req.params.fileId, req.params.versionId);
  if (!version) return void res.status(404).json({ error: 'Version not found' });
  res.json(version);
}));

router.post('/', authenticate, requireProjectAccess('write', fileParam), wrap((req, res) =>
  forward(res, () => collabClient.snapshot(req.params.fileId, req.user.id))));

router.post('/:versionId/restore', authenticate, requireProjectAccess('restore', fileParam), wrap((req, res) =>
  forward(res, () => collabClient.restore(req.params.fileId, req.params.versionId, req.user.id))));

export default router;
