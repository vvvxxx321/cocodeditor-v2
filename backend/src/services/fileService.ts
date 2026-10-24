import { prisma } from '../database/prismaClient';

interface CreateFileParams {
  name: string;
  content: string;
  language?: string;
  projectId: string;
}

interface UpdateFileParams {
  id: string;
  content: string;
  language?: string;
}

// Helper function to normalize file paths
const normalizePath = (path: string): string => {
  // Remove any double slashes and normalize path
  return path.replace(/\/\//g, '/').trim();
};

export const fileService = {
  /**
   * Create a new file in a project
   */
  createFile: async (params: CreateFileParams) => {
    const { name, content, language, projectId } = params;
    const normalizedName = normalizePath(name);

    console.log(`[FileService] Creating file '${normalizedName}' in project ${projectId}`);

    // Check if file already exists in this project
    const existingFile = await prisma.file.findFirst({
      where: {
        name: normalizedName,
        projectId
      }
    });

    if (existingFile) {
      console.log(`[FileService] File '${normalizedName}' already exists, id: ${existingFile.id}`);
      throw new Error(`File with name '${normalizedName}' already exists in this project`);
    }

    const file = await prisma.file.create({
      data: {
        name: normalizedName,
        content,
        language,
        project: {
          connect: { id: projectId }
        }
      }
    });
    
    console.log(`[FileService] Created file '${normalizedName}' with id: ${file.id}`);
    return file;
  },

  /**
   * Get all files for a project
   */
  getProjectFiles: async (projectId: string) => {
    console.log(`[FileService] Getting all files for project ${projectId}`);
    
    const files = await prisma.file.findMany({
      where: {
        projectId
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`[FileService] Found ${files.length} files for project ${projectId}`);
    files.forEach(file => {
      console.log(`[FileService] - File: ${file.name}, id: ${file.id}`);
    });
    
    return files;
  },

  /**
   * Get a specific file by ID
   */
  getFileById: async (fileId: string) => {
    console.log(`[FileService] Getting file by id: ${fileId}`);
    
    const file = await prisma.file.findUnique({
      where: {
        id: fileId
      }
    });
    
    if (file) {
      console.log(`[FileService] Found file: ${file.name}, id: ${file.id}`);
    } else {
      console.log(`[FileService] File with id ${fileId} not found`);
    }
    
    return file;
  },

  /**
   * Get a specific file by name and project ID
   */
  getFileByNameAndProject: async (name: string, projectId: string) => {
    const normalizedName = normalizePath(name);
    console.log(`[FileService] Getting file by name: '${normalizedName}' in project ${projectId}`);
    
    const file = await prisma.file.findFirst({
      where: {
        name: normalizedName,
        projectId
      }
    });
    
    if (file) {
      console.log(`[FileService] Found file: ${file.name}, id: ${file.id}`);
    } else {
      console.log(`[FileService] No file found with name '${normalizedName}' in project ${projectId}`);
    }
    
    return file;
  },

  /**
   * Update a file's content
   */
  updateFile: async (params: UpdateFileParams) => {
    const { id, content, language } = params;
    console.log(`[FileService] Updating file with id: ${id}`);
    
    const file = await prisma.file.update({
      where: {
        id
      },
      data: {
        content,
        ...(language && { language }),
        updatedAt: new Date()
      }
    });
    
    console.log(`[FileService] Updated file: ${file.name}, id: ${file.id}`);
    return file;
  },

  /**
   * Update or create a file by name in a project
   */
  upsertFile: async (projectId: string, name: string, content: string, language?: string) => {
    const normalizedName = normalizePath(name);
    console.log(`[FileService] Upserting file '${normalizedName}' in project ${projectId}`);
    
    const existingFile = await prisma.file.findFirst({
      where: {
        name: normalizedName,
        projectId
      }
    });

    if (existingFile) {
      console.log(`[FileService] File '${normalizedName}' exists, updating id: ${existingFile.id}`);
      // Update existing file
      const file = await prisma.file.update({
        where: {
          id: existingFile.id
        },
        data: {
          content,
          ...(language && { language }),
          updatedAt: new Date()
        }
      });
      
      console.log(`[FileService] Updated file: ${file.name}, id: ${file.id}`);
      return file;
    } else {
      console.log(`[FileService] File '${normalizedName}' doesn't exist, creating new file`);
      // Create new file
      const file = await prisma.file.create({
        data: {
          name: normalizedName,
          content,
          language,
          project: {
            connect: { id: projectId }
          }
        }
      });
      
      console.log(`[FileService] Created new file: ${file.name}, id: ${file.id}`);
      return file;
    }
  },

  /**
   * Delete a file
   */
  deleteFile: async (fileId: string) => {
    console.log(`[FileService] Deleting file with id: ${fileId}`);
    
    const file = await prisma.file.delete({
      where: {
        id: fileId
      }
    });
    
    console.log(`[FileService] Deleted file: ${file.name}, id: ${file.id}`);
    return file;
  },

  /**
   * Delete a file by name and project ID
   */
  deleteFileByNameAndProject: async (name: string, projectId: string) => {
    const normalizedName = normalizePath(name);
    console.log(`[FileService] Deleting file by name: '${normalizedName}' in project ${projectId}`);
    
    const file = await prisma.file.findFirst({
      where: {
        name: normalizedName,
        projectId
      }
    });

    if (!file) {
      console.log(`[FileService] No file found with name '${normalizedName}' in project ${projectId}`);
      throw new Error(`File '${normalizedName}' not found in project`);
    }

    console.log(`[FileService] Found file to delete: ${file.name}, id: ${file.id}`);
    
    const deletedFile = await prisma.file.delete({
      where: {
        id: file.id
      }
    });
    
    console.log(`[FileService] Deleted file: ${deletedFile.name}, id: ${deletedFile.id}`);
    return deletedFile;
  }
};
