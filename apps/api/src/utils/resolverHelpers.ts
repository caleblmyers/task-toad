import { z } from 'zod';
import type { Context } from '../graphql/context.js';
import { NotFoundError, ValidationError } from '../graphql/errors.js';
import { requireOrg } from '../graphql/resolvers/auth.js';

// ── Resource helpers ──

/**
 * Fetch a task by ID, validate org ownership, return task with project included.
 */
export async function requireTask(context: Context, taskId: string) {
  const user = requireOrg(context);
  const task = await context.prisma.task.findUnique({
    where: { taskId },
    include: { project: true },
  });
  if (!task || task.orgId !== user.orgId) {
    throw new NotFoundError('Task not found');
  }
  return { user, task };
}

/**
 * Fetch a project by ID, validate org ownership.
 */
export async function requireProject(context: Context, projectId: string) {
  const user = requireOrg(context);
  const project = await context.prisma.project.findFirst({
    where: { projectId, orgId: user.orgId },
  });
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  return { user, project };
}

/**
 * Validate a proposed status against a list of valid statuses.
 */
export function validateStatus(validStatuses: string[], proposed: string): void {
  if (!validStatuses.includes(proposed)) {
    throw new ValidationError(`Invalid status "${proposed}". Valid: ${validStatuses.join(', ')}`);
  }
}

// ── Zod input schemas ──

export const CreateTaskInput = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  description: z.string().max(10000, 'Description must be 10000 characters or less').optional(),
});

export const UpdateTaskInput = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less').optional(),
  description: z.string().max(10000, 'Description must be 10000 characters or less').optional(),
  instructions: z.string().max(50000, 'Instructions must be 50000 characters or less').optional(),
  acceptanceCriteria: z.string().max(10000, 'Acceptance criteria must be 10000 characters or less').optional(),
});

export const CreateCommentInput = z.object({
  content: z.string().min(1, 'Comment body is required').max(5000, 'Comment must be 5000 characters or less'),
});

export const CreateProjectInput = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
});

/**
 * Parse a Zod schema and throw a ValidationError on failure.
 */
export function parseInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join('; ');
    throw new ValidationError(messages);
  }
  return result.data;
}

/**
 * Sanitize user-provided strings before injecting into AI prompts.
 * Escapes quotes and wraps in safe delimiters to prevent prompt injection.
 */
export function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
