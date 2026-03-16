---
name: swarm-worker
description: Start working as a swarm worker. Reads tasks.json, finds tasks assigned to this worker, and implements them. Use when inside a worker worktree and the user says "/swarm-worker", "start working", or "begin tasks".
disable-model-invocation: false
user-invocable: true
---

Start working. Read your tasks from /home/caleb/projects/task-toad/.ai/swarm/tasks.json, find tasks assigned to you, and begin implementing them. Follow the workflow in your CLAUDE.md. After completing each task, run `pnpm typecheck && pnpm lint && pnpm build` to validate before marking complete.

When you have no remaining pending tasks but some of your tasks are still waiting for review (status "completed" but not yet "merged"), do NOT exit. Poll tasks.json every 30 seconds. If the reviewer sends a task back (status changes to "in_progress" with reviewNotes), read the notes, fix the issues, re-validate, and mark completed again. Only exit once ALL of your tasks are "merged".
