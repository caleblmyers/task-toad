---
name: task-reviewer
description: Start reviewing as the swarm reviewer. Watches tasks.json for completed tasks, reviews and merges them. Use when inside the reviewer worktree and the user says "/task-reviewer", "start reviewing", or "begin review".
disable-model-invocation: false
user-invocable: true
---

Start reviewing. Watch /home/caleb/projects/task-toad/.ai/taskswarm/tasks.json for completed tasks and review/merge them following your CLAUDE.md workflow. Loop until all tasks are merged. Remember: you NEVER write code — send tasks back to workers if anything fails validation.

While reviewing, watch for related improvements or follow-up work that is out of scope for the current task but worth tracking. After each merge, check /home/caleb/projects/task-toad/.claude-knowledge/todos.md and append any new ideas to the relevant work set (or create a new section if none fits). If something already exists as a todo, skip it. Examples of things to note: edge cases not handled, missing tests, performance concerns, accessibility gaps, UX improvements suggested by the code, or features that would naturally complement what was just built.
