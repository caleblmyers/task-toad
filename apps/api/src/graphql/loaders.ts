import DataLoader from 'dataloader';
import type { PrismaClient, Task, Project, Sprint, User, Label, GitHubPullRequestLink, GitHubCommitLink, CustomFieldValue, CustomField, TaskAssignee, Attachment, TaskDependency } from '@prisma/client';

export type CustomFieldValueWithField = CustomFieldValue & { customField: CustomField };
export type TaskAssigneeWithUser = TaskAssignee & { user: User };
export type TaskDependencyWithTask = TaskDependency & { targetTask: Task };
export type TaskDependentWithTask = TaskDependency & { sourceTask: Task };

export interface Loaders {
  taskById: DataLoader<string, Task | null>;
  projectById: DataLoader<string, Project | null>;
  sprintById: DataLoader<string, Sprint | null>;
  userById: DataLoader<string, User | null>;
  taskLabels: DataLoader<string, Label[]>;
  taskPullRequests: DataLoader<string, GitHubPullRequestLink[]>;
  taskCommits: DataLoader<string, GitHubCommitLink[]>;
  taskChildren: DataLoader<string, Task[]>;
  taskProgress: DataLoader<string, { total: number; completed: number } | null>;
  sprintTasks: DataLoader<string, Task[]>;
  customFieldValuesByTask: DataLoader<string, CustomFieldValueWithField[]>;
  taskAssignees: DataLoader<string, TaskAssigneeWithUser[]>;
  taskAttachments: DataLoader<string, Attachment[]>;
  taskDependencies: DataLoader<string, TaskDependencyWithTask[]>;
  taskDependents: DataLoader<string, TaskDependentWithTask[]>;
}

export function createLoaders(prisma: PrismaClient): Loaders {
  return {
    taskById: new DataLoader(async (ids) => {
      const tasks = await prisma.task.findMany({ where: { taskId: { in: [...ids] } } });
      const map = new Map(tasks.map(t => [t.taskId, t]));
      return ids.map(id => map.get(id) ?? null);
    }),

    projectById: new DataLoader(async (ids) => {
      const projects = await prisma.project.findMany({ where: { projectId: { in: [...ids] } } });
      const map = new Map(projects.map(p => [p.projectId, p]));
      return ids.map(id => map.get(id) ?? null);
    }),

    sprintById: new DataLoader(async (ids) => {
      const sprints = await prisma.sprint.findMany({ where: { sprintId: { in: [...ids] } } });
      const map = new Map(sprints.map(s => [s.sprintId, s]));
      return ids.map(id => map.get(id) ?? null);
    }),

    userById: new DataLoader(async (ids) => {
      const users = await prisma.user.findMany({ where: { userId: { in: [...ids] } } });
      const map = new Map(users.map(u => [u.userId, u]));
      return ids.map(id => map.get(id) ?? null);
    }),

    taskLabels: new DataLoader(async (taskIds) => {
      const taskLabels = await prisma.taskLabel.findMany({
        where: { taskId: { in: [...taskIds] } },
        include: { label: true },
      });
      const map = new Map<string, Label[]>();
      for (const tl of taskLabels) {
        if (!map.has(tl.taskId)) map.set(tl.taskId, []);
        map.get(tl.taskId)!.push(tl.label);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskPullRequests: new DataLoader(async (taskIds) => {
      const prs = await prisma.gitHubPullRequestLink.findMany({
        where: { taskId: { in: [...taskIds] } },
      });
      const map = new Map<string, GitHubPullRequestLink[]>();
      for (const pr of prs) {
        if (!map.has(pr.taskId)) map.set(pr.taskId, []);
        map.get(pr.taskId)!.push(pr);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskCommits: new DataLoader(async (taskIds) => {
      const commits = await prisma.gitHubCommitLink.findMany({
        where: { taskId: { in: [...taskIds] } },
      });
      const map = new Map<string, GitHubCommitLink[]>();
      for (const c of commits) {
        if (!map.has(c.taskId)) map.set(c.taskId, []);
        map.get(c.taskId)!.push(c);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskChildren: new DataLoader(async (parentIds) => {
      const children = await prisma.task.findMany({
        where: { parentTaskId: { in: [...parentIds] }, archived: false },
        orderBy: { position: 'asc' },
      });
      const map = new Map<string, Task[]>();
      for (const c of children) {
        if (!map.has(c.parentTaskId!)) map.set(c.parentTaskId!, []);
        map.get(c.parentTaskId!)!.push(c);
      }
      return parentIds.map(id => map.get(id) ?? []);
    }),

    taskProgress: new DataLoader(async (taskIds) => {
      const children = await prisma.task.findMany({
        where: { parentTaskId: { in: [...taskIds] }, archived: false },
        select: { parentTaskId: true, status: true },
      });
      const map = new Map<string, { total: number; completed: number }>();
      for (const c of children) {
        if (!map.has(c.parentTaskId!)) map.set(c.parentTaskId!, { total: 0, completed: 0 });
        const p = map.get(c.parentTaskId!)!;
        p.total++;
        if (c.status === 'done') p.completed++;
      }
      return taskIds.map(id => map.get(id) ?? null);
    }),

    sprintTasks: new DataLoader(async (sprintIds) => {
      const tasks = await prisma.task.findMany({
        where: { sprintId: { in: [...sprintIds] }, parentTaskId: null },
      });
      const map = new Map<string, Task[]>();
      for (const t of tasks) {
        if (!t.sprintId) continue;
        if (!map.has(t.sprintId)) map.set(t.sprintId, []);
        map.get(t.sprintId)!.push(t);
      }
      return sprintIds.map(id => map.get(id) ?? []);
    }),

    taskAssignees: new DataLoader(async (taskIds) => {
      const assignees = await prisma.taskAssignee.findMany({
        where: { taskId: { in: [...taskIds] } },
        include: { user: true },
      });
      const map = new Map<string, TaskAssigneeWithUser[]>();
      for (const a of assignees) {
        if (!map.has(a.taskId)) map.set(a.taskId, []);
        map.get(a.taskId)!.push(a);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskAttachments: new DataLoader(async (taskIds) => {
      const attachments = await prisma.attachment.findMany({
        where: { taskId: { in: [...taskIds] } },
        orderBy: { createdAt: 'desc' },
      });
      const map = new Map<string, Attachment[]>();
      for (const a of attachments) {
        if (!map.has(a.taskId)) map.set(a.taskId, []);
        map.get(a.taskId)!.push(a);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskDependencies: new DataLoader(async (taskIds) => {
      const deps = await prisma.taskDependency.findMany({
        where: { sourceTaskId: { in: [...taskIds] } },
        include: { targetTask: true },
      });
      const map = new Map<string, TaskDependencyWithTask[]>();
      for (const d of deps) {
        if (!map.has(d.sourceTaskId)) map.set(d.sourceTaskId, []);
        map.get(d.sourceTaskId)!.push(d);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    taskDependents: new DataLoader(async (taskIds) => {
      const deps = await prisma.taskDependency.findMany({
        where: { targetTaskId: { in: [...taskIds] } },
        include: { sourceTask: true },
      });
      const map = new Map<string, TaskDependentWithTask[]>();
      for (const d of deps) {
        if (!map.has(d.targetTaskId)) map.set(d.targetTaskId, []);
        map.get(d.targetTaskId)!.push(d);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),

    customFieldValuesByTask: new DataLoader(async (taskIds) => {
      const values = await prisma.customFieldValue.findMany({
        where: { taskId: { in: [...taskIds] } },
        include: { customField: true },
      });
      const map = new Map<string, CustomFieldValueWithField[]>();
      for (const v of values) {
        if (!map.has(v.taskId)) map.set(v.taskId, []);
        map.get(v.taskId)!.push(v);
      }
      return taskIds.map(id => map.get(id) ?? []);
    }),
  };
}
