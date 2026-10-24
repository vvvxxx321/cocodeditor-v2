import { Request, Response } from 'express';
import { fileService } from '../services/fileService';
import { authenticate } from '../middleware/auth';

export const fileController = {
  /**
   * Create a new file in a project
   */
  createFile: async (req: Request, res: Response) => {
    try {
      const { name, content, language, projectId } = req.body;

      if (!name || !projectId) {
        return res.status(400).json({ error: 'Missing required fields: name, projectId' });
      }

      const file = await fileService.createFile({
        name,
        content: content || '',
        language,
        projectId
      });

      return res.status(201).json(file);
    } catch (error: any) {
      console.error('Error creating file:', error);
      return res.status(500).json({ error: error.message || 'Failed to create file' });
    }
  },

  /**
   * Get all files for a project
   */
  getProjectFiles: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: 'Missing required parameter: projectId' });
      }

      const files = await fileService.getProjectFiles(projectId);
      return res.status(200).json(files);
    } catch (error: any) {
      console.error('Error fetching project files:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch project files' });
    }
  },

  /**
   * Get a specific file by ID
   */
  getFileById: async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({ error: 'Missing required parameter: fileId' });
      }

      const file = await fileService.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      return res.status(200).json(file);
    } catch (error: any) {
      console.error('Error fetching file:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch file' });
    }
  },

  /**
   * Update a file's content
   */
  updateFile: async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const { content, language } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'Missing required parameter: fileId' });
      }

      if (content === undefined) {
        return res.status(400).json({ error: 'Missing required field: content' });
      }

      const file = await fileService.updateFile({
        id: fileId,
        content,
        language
      });

      return res.status(200).json(file);
    } catch (error: any) {
      console.error('Error updating file:', error);
      return res.status(500).json({ error: error.message || 'Failed to update file' });
    }
  },

  /**
   * Delete a file
   */
  deleteFile: async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({ error: 'Missing required parameter: fileId' });
      }

      await fileService.deleteFile(fileId);
      return res.status(200).json({ message: 'File deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete file' });
    }
  }
};
