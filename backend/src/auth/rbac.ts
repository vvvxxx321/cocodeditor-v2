import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../database/prismaClient';

/**
 * Server-side RBAC. Every project/file access is resolved to the caller's role in the
 * owning team; the client never supplies its own identity or role.
 */
export type Action = 'read' | 'write' | 'run' | 'restore' | 'delete' | 'manageMembers';

const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

const MIN_ROLE: Record<Action, Role> = {
  read: Role.VIEWER,
  write: Role.MEMBER,
  run: Role.MEMBER,
  restore: Role.MEMBER,
  delete: Role.ADMIN,
  manageMembers: Role.ADMIN,
};

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[MIN_ROLE[action]];
}

export async function getTeamRole(userId: string, teamId: string): Promise<Role | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
  if (!team) return null;
  if (team.ownerId === userId) return Role.OWNER;
  const member = await prisma.teamMember.findUnique({
    where: { teamId_profileId: { teamId, profileId: userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

export interface ProjectAccess {
  projectId: string;
  teamId: string;
  role: Role;
}

export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, teamId: true } });
  if (!project) return null;
  const role = await getTeamRole(userId, project.teamId);
  return role ? { projectId: project.id, teamId: project.teamId, role } : null;
}

export async function getFileAccess(userId: string, fileId: string): Promise<(ProjectAccess & { fileId: string }) | null> {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { id: true, projectId: true } });
  if (!file) return null;
  const access = await getProjectAccess(userId, file.projectId);
  return access ? { ...access, fileId: file.id } : null;
}

type Source = 'params' | 'body' | 'query';

/**
 * Express middleware: resolves the project (directly, or via a file id) and enforces the action.
 * Returns 404 for missing resources and for resources the caller cannot see (no existence leak),
 * and 403 when the caller is a member but lacks the required role.
 */
export function requireProjectAccess(action: Action, opts: { projectId?: [Source, string]; fileId?: [Source, string] }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    try {
      let access: ProjectAccess | null = null;
      if (opts.fileId) {
        const id = (req as any)[opts.fileId[0]]?.[opts.fileId[1]];
        if (!id) return void res.status(400).json({ error: 'Missing file id' });
        access = await getFileAccess(userId, String(id));
      } else if (opts.projectId) {
        const id = (req as any)[opts.projectId[0]]?.[opts.projectId[1]];
        if (!id) return void res.status(400).json({ error: 'Missing project id' });
        access = await getProjectAccess(userId, String(id));
      }
      if (!access) return void res.status(404).json({ error: 'Not found' });
      if (!can(access.role, action)) return void res.status(403).json({ error: 'Forbidden' });
      res.locals.access = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireTeamRole(action: Action, param = 'teamId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.params[param] || req.body?.[param];
    if (!userId) return void res.status(401).json({ message: 'User not authenticated' });
    if (!teamId) return void res.status(400).json({ error: 'Team ID is required' });
    try {
      const role = await getTeamRole(userId, teamId);
      if (!role) return void res.status(404).json({ error: 'Not found' });
      if (!can(role, action)) return void res.status(403).json({ error: 'Forbidden' });
      res.locals.teamRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
