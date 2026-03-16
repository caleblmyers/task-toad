# Worker Branch Strategy

## One branch per worker, one commit per task

Each worker operates in a dedicated worktree on a single branch (e.g., `swarm/worker-1`). All tasks assigned to that worker are committed sequentially on that branch. Do NOT create separate branches per task — the worktree IS the branch.

## Commit cadence

Commit after completing each task, before marking it `completed`. Each task gets exactly one commit. This allows the reviewer to merge tasks individually and gives clean git history.

## Rebase after merge

When the reviewer merges your task into `main`, your branch diverges. Before starting your next task, always rebase onto the updated main:

```bash
git fetch /home/caleb/projects/task-toad main
git rebase FETCH_HEAD
```

This is critical when you have multiple tasks — without rebasing, your next commit will include the diff of the already-merged task, causing conflicts when the reviewer tries to merge the next one.

## Handling review rejection

If a task is sent back by the reviewer (status changes to `in_progress` with `reviewNotes`):

1. Read the review notes carefully
2. Fix the issues on the same branch
3. Amend the existing commit (`git commit --amend`) if the task commit is the latest
4. If you've already committed another task on top, create a new fixup commit instead
5. Re-validate (`pnpm typecheck && pnpm lint && pnpm build`)
6. Mark the task `completed` again

## Parallel task execution

After completing a task and marking it `completed`, you don't have to wait for the reviewer to merge it. Check if your next pending task shares any files with the completed task:

- **No file overlap** → Start immediately. You may have two tasks in flight (one awaiting review, one in progress).
- **Files overlap** → Wait for the previous task to be merged, then rebase before starting.

## What the reviewer does

The reviewer uses `scripts/swarm/merge-worker.sh` to merge worker branches:

1. Squash-merges the worker branch into main (all task commits become one merge commit)
2. If `--validate` flag is used: temporarily merges, runs `prisma generate` (if schema changed), then `pnpm typecheck` + `pnpm lint`, and aborts if any fail
3. The reviewer commits the squash merge on main

## Do NOT push

Workers never push their branches to the remote. All merging happens locally in the reviewer's worktree. Only the user pushes `main` to the remote after the wave is complete.
