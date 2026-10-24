import { prisma } from '../database/prismaClient';

interface CreateProjectParams {
  name: string;
  description?: string;
  teamId: string;
}

export const projectService = {
  /**
   * Create a new project
   */
  createProject: async (params: CreateProjectParams) => {
    const { name, description, teamId } = params;

    return await prisma.project.create({
      data: {
        name,
        description,
        team: {
          connect: { id: teamId }
        }
      },
      include: {
        team: true
      }
    });
  },

  /**
   * Get all projects for a specific team
   */
  getProjectsByTeamId: async (teamId: string) => {
    return await prisma.project.findMany({
      where: {
        teamId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        files: {
          select: {
            id: true,
            name: true,
            language: true
          }
        }
      }
    });
  },

  /**
   * Get project by ID
   */
  getProjectById: async (projectId: string) => {
    return await prisma.project.findUnique({
      where: {
        id: projectId
      },
      include: {
        files: true,
        team: true
      }
    });
  },

  /**
   * Delete a project by ID
   */
  deleteProject: async (projectId: string) => {
    return await prisma.project.delete({
      where: {
        id: projectId
      },
      include: {
        team: true
      }
    });
  }
};
