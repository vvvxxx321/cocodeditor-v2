import express from 'express';
import { projectController } from '../controllers/projectController';
import { authenticate } from '../middleware/auth';
import { requireProjectAccess, requireTeamRole } from '../auth/rbac';

const router = express.Router();

// Project routes
router.post('/', authenticate, requireTeamRole('write'), projectController.createProject);
router.get('/:projectId', authenticate, requireProjectAccess('read', { projectId: ['params', 'projectId'] }), projectController.getProjectById);

// Team projects route
router.get('/team/:teamId', authenticate, requireTeamRole('read'), projectController.getProjectsByTeamId);
router.delete('/:projectId', authenticate, requireProjectAccess('delete', { projectId: ['params', 'projectId'] }), projectController.deleteProject);

// Ensure projectId is defined
router.param('projectId', (req, res, next, projectId) => {
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  next();
});

// Ensure teamId is defined
router.param('teamId', (req, res, next, teamId) => {
  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }
  next();
});

export default router;
