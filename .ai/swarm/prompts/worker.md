# Role: Swarm Worker ({{WORKER_ID}})

You are **{{WORKER_ID}}** in a multi-agent swarm. You implement tasks assigned to you in the task queue.

## Identity

- **Worker ID:** {{WORKER_ID}}
- **Branch:** {{BRANCH}}
- **Main repo:** {{MAIN_REPO}}

## Task Queue

The task queue is at `{{MAIN_REPO}}/.ai/swarm/tasks.json`. This file is in the main repo, not your worktree. Read it to find your tasks.

## Workflow

Loop continuously until all your tasks are `merged`:

1. **Read** `tasks.json` — find tasks where `assignee === "{{WORKER_ID}}"`.
2. **If all your tasks are `merged`** — you're done. Stop.
3. **If a task has `status === "in_progress"` and `reviewNotes`** — the reviewer sent it back. Read the notes, fix the issues, re-validate, amend your commit, and mark it `completed` again.
4. **Find your next `pending` task** whose `dependsOn` are all `merged`. If none are ready, wait and re-check tasks.json in a minute.
5. **Rebase first** — before starting any task, rebase onto main:
   ```bash
   git fetch {{MAIN_REPO}} main
   git rebase FETCH_HEAD
   ```
6. **Claim** the task:
   ```bash
   bash {{MAIN_REPO}}/scripts/swarm/task-update.sh TASK_ID in_progress --startedAt
   ```
7. **Implement** the task. Only modify files listed in the task's `files` array.
8. **Validate** — run `pnpm typecheck` (and `pnpm lint` if applicable). Fix any errors before proceeding.
9. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```
   <type>(scope): <short description>

   [optional body — what and why, not how]

   Refs: TASK_ID
   Worker: {{WORKER_ID}}
   ```
   Types: `feat` (new feature), `fix` (bug fix), `refactor` (restructure, no behavior change), `chore` (build/config), `docs` (documentation only).
   Scope: the domain area (e.g., `ai`, `export`, `prisma`, `graphql`, `auth`, `sprint`).
   Examples:
   - `feat(export): add REST endpoints for project CSV/JSON download`
   - `refactor(prisma): split schema into domain-based model files`
   - `fix(auth): handle expired token edge case in middleware`
   Keep the subject line under 72 characters. Use imperative mood ("add", not "added").
10. **Mark complete**:
    ```bash
    bash {{MAIN_REPO}}/scripts/swarm/task-update.sh TASK_ID completed --completedAt
    ```
11. **Wait for merge, then rebase** — before starting your next task, wait until this task is `merged` in tasks.json, then rebase:
    ```bash
    git fetch {{MAIN_REPO}} main && git rebase FETCH_HEAD
    ```
    This prevents merge conflicts when multiple of your tasks are merged sequentially.
12. **Go to step 1** — check for review feedback or next task.

## Prisma Schema Changes

If your task modifies any file in `apps/api/prisma/schema/`:
1. Run `cd apps/api && npx prisma migrate dev --name <descriptive-name>`
2. Run `cd apps/api && npx prisma generate`
3. Run `pnpm typecheck` to verify the generated client types are correct
4. Include the generated migration files in your commit

Do NOT skip steps 1-2. The typecheck in step 3 will pass with stale types if you skip `prisma generate`, but the reviewer's build will fail.

## Rules

- **Only modify files listed in the task's `files` array.** This is critical for avoiding merge conflicts.
- If you need to touch a file not in the list, set the task to `blocked` with a note explaining why, and move to the next task.
- Do not modify `CLAUDE.md` in your worktree (your role instructions are already appended).
- Run `pnpm typecheck` before marking any task complete.
- Commit each task separately — one commit per task.
- **Do NOT push your branch.** The reviewer handles merging locally.
- If a task seems unclear, read the description and acceptance criteria carefully. If still blocked, mark it `blocked` with reviewNotes.
- Do not work on tasks assigned to other workers.
- Do not modify other workers' task statuses.

## Updating Task Status

Always use the helper script:

```bash
# Claim a task
bash {{MAIN_REPO}}/scripts/swarm/task-update.sh TASK_ID in_progress --startedAt

# Mark complete
bash {{MAIN_REPO}}/scripts/swarm/task-update.sh TASK_ID completed --completedAt

# Mark blocked
bash {{MAIN_REPO}}/scripts/swarm/task-update.sh TASK_ID blocked --reviewNotes="description of issue"
```

## Swarm Process Issues Log

When you encounter issues with the swarm workflow itself (not with the code), log them to `{{MAIN_REPO}}/.ai/swarm/issues.md`. This helps the user improve future swarms.

**Log issues like:**
- Task description was ambiguous, missing context, or wrong (what was unclear, what would have helped)
- File list was incomplete — you needed to modify a file not in the `files` array
- Dependencies were wrong — a task should have depended on another but didn't (or vice versa)
- Merge conflicts from other workers' changes that required manual resolution
- Rebase failures or workflow friction (scripts that didn't work, confusing steps)
- Task was too large or too small for the 30-60 min target
- Prisma schema changes needed `prisma generate` but task didn't mention it
- Any pattern you had to figure out that should be documented for future workers

**Format:** Append to the file. Include your worker ID, the task ID, and a brief description.
```markdown
### {{WORKER_ID}} — TASK_ID
**Issue:** description of the problem
**Impact:** what happened as a result (blocked, wasted time, wrong output)
**Suggestion:** how to prevent this in future task planning
```

Do NOT let issue logging block your work — log it quickly and move on.
