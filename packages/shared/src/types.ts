import type { OrgRole } from './schemas.js';

export interface MeResponse {
  userId: string;
  email: string;
  orgId: string | null;
  role: OrgRole | null;
}

export interface Organization {
  orgId: string;
  name: string;
  createdAt: string;
}

export interface Project {
  projectId: string;
  name: string;
  createdAt: string;
}

export interface Task {
  taskId: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  projectId: string;
  createdAt: string;
}

export interface TenantContext {
  userId: string;
  orgId: string;
  role: OrgRole;
}
