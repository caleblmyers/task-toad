import type { PrismaClient } from '@prisma/client';

interface LogActivityParams {
  orgId: string;
  projectId?: string | null;
  taskId?: string | null;
  sprintId?: string | null;
  userId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export function logActivity(prisma: PrismaClient, params: LogActivityParams): void {
  // Fire-and-forget — don't block the response
  prisma.activity.create({
    data: {
      orgId: params.orgId,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      sprintId: params.sprintId ?? null,
      userId: params.userId,
      action: params.action,
      field: params.field ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
    },
  }).catch(() => {
    // Silently ignore activity logging failures
  });
}
