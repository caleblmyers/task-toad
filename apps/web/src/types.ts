export interface MeResponse {
  userId: string;
  email: string;
  orgId: string | null;
  role: 'org:admin' | 'org:member' | null;
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
