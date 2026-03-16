---
name: swarm
description: Spawn a new AI swarm wave — create worktrees, plan tasks from todos.md, write tasks.json, and output copy-paste prompts for workers and reviewer. Use when the user says "set up swarm", "spawn workers", "next wave", or "start swarm".
disable-model-invocation: false
user-invocable: true
---

# Spawn AI Swarm Wave

You are setting up a new swarm wave. Follow these steps precisely.

## Pre-flight Checks

1. **Verify clean state:**
   - Run `git status` — working tree must be clean (commit or stash first if dirty)
   - Run `git worktree list` — no stale worktrees should exist (run teardown if needed)
   - Check for stale swarm branches: `git branch | grep swarm`

2. **Read current state:**
   - Read `.claude-knowledge/todos.md` to understand available work sets
   - Read the Parallelism Matrix to identify which sets can run together
   - Check the Completed section to know what's already done

## Planning

3. **Select sets for this wave:**
   - Pick 3 sets (one per worker) that have NO file overlap per the Parallelism Matrix
   - If the user specified sets (e.g., "spawn W2 + W4 + W5"), use those
   - Otherwise, select the highest-value conflict-free combination
   - Present the plan to the user for confirmation before proceeding

4. **Research source files:**
   - For each selected set, use Agent (Explore) to read the relevant source files
   - Understand current code state so task descriptions are precise and detailed

5. **Write tasks following the Task Sizing rules (CRITICAL):**
   - Each task MUST represent **30-60 minutes** of agentic work
   - Combine into **full vertical slices**: schema + resolver + typeDefs + frontend in ONE task
   - Never create tasks that are just config changes or single-file edits
   - Each worker should have **2-4 tasks** totaling 30-60 min
   - Task descriptions should be 2-3 paragraphs with specific file paths, code snippets, and implementation details
   - Include acceptance criteria that are concrete and verifiable
   - **Worker parallelism:** When a worker has multiple tasks, minimize file overlap between them so the worker can start the next task while the previous one is in review. If two tasks on the same worker must share files, order them sequentially and note the dependency.

## Execution

6. **Spawn worktrees:**
   ```bash
   bash scripts/swarm/spawn.sh 3
   ```

7. **Write tasks.json** with all planned tasks.

8. **Output copy-paste prompts** for the user:

   Format the output clearly with headers and code blocks:

   ### Worker 1 (`cd ~/projects/task-toad-worker-1 && claude`)
   ```
   Start working. Read your tasks from /home/caleb/projects/task-toad/.ai/swarm/tasks.json, find tasks assigned to you, and begin implementing them. Follow the workflow in your CLAUDE.md.
   ```

   ### Worker 2 (`cd ~/projects/task-toad-worker-2 && claude`)
   ```
   Start working. Read your tasks from /home/caleb/projects/task-toad/.ai/swarm/tasks.json, find tasks assigned to you, and begin implementing them. Follow the workflow in your CLAUDE.md.
   ```

   ### Worker 3 (`cd ~/projects/task-toad-worker-3 && claude`)
   ```
   Start working. Read your tasks from /home/caleb/projects/task-toad/.ai/swarm/tasks.json, find tasks assigned to you, and begin implementing them. Follow the workflow in your CLAUDE.md.
   ```

   ### Reviewer (`cd ~/projects/task-toad-reviewer && claude`)
   ```
   Start reviewing. Watch /home/caleb/projects/task-toad/.ai/swarm/tasks.json for completed tasks and review/merge them following your CLAUDE.md workflow. Loop until all tasks are merged.
   ```

9. **Show a summary table** of the wave plan:

   | Worker | Set | Tasks | Description |
   |--------|-----|-------|-------------|
   | worker-1 | ... | task-001, task-002 | ... |
   | worker-2 | ... | task-003, task-004 | ... |
   | worker-3 | ... | task-005, task-006 | ... |
