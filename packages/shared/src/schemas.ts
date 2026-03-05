import { z } from 'zod';

export const orgRoleSchema = z.enum(['org:admin', 'org:member']);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  status: z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
