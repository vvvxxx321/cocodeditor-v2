import express from "express";
import projectRoutes from "./project";
import teamRoutes from "./team";
import { authenticate } from '../middleware/auth';
import { teamController } from '../controllers/teamController';
import { fileController } from '../controllers/fileController';
import { requireProjectAccess } from '../auth/rbac';
import versionRoutes from './versions';

const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Public routes
router.get("/", (req, res) => {
  res.send("Hello World!");
});

// Direct route for joining team by code
router.post("/teams/join-by-code-direct", authenticate, teamController.joinTeamByCodeOnly);

// File routes
// V2: every file route resolves the owning project and enforces team RBAC (V1 had no checks).
router.post("/files", authenticate, requireProjectAccess('write', { projectId: ['body', 'projectId'] }), fileController.createFile);
router.get("/files/project/:projectId", authenticate, requireProjectAccess('read', { projectId: ['params', 'projectId'] }), fileController.getProjectFiles);
router.get("/files/:fileId", authenticate, requireProjectAccess('read', { fileId: ['params', 'fileId'] }), fileController.getFileById);
router.put("/files/:fileId", authenticate, requireProjectAccess('write', { fileId: ['params', 'fileId'] }), fileController.updateFile);
router.use("/files/:fileId/versions", versionRoutes);
router.delete("/files/:fileId", authenticate, requireProjectAccess('write', { fileId: ['params', 'fileId'] }), fileController.deleteFile);

// Team routes
router.use("/teams", teamRoutes);

// Project routes
router.use("/projects", projectRoutes);

export default router;