export type Role = 'MEMBER' | 'ADMIN' | 'OWNER';

export interface Profile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

export interface TeamMember {
  id: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
  profileId: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
}

export interface File {
  id: string;
  name: string;
  content: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
}

export interface Collaborator {
  id: string;
  name?: string;
  email: string;
  status: 'online' | 'offline' | 'away';
  avatar?: string;
  lastSeen?: Date;
  username?: string;
} 