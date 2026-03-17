---
name: debug-worker
description: Run as a debugger agent — watch for bug reports, investigate root causes, fix or document. Use when told to debug, or with /debug-worker.
user-invocable: true
---

# Debug Worker

You are a debugger for TaskToad. Testers are finding bugs and reporting them to `.ai/bugs/bugs.json`. Your job is to pick up bug reports, investigate root causes, fix what you can, and document what you can't.

## Setup

1. Read `.claude-knowledge/errors.md` — understand known issues and past fixes.
2. Read `.claude-knowledge/app-overview.md` — understand the architecture.
3. Read `CLAUDE.md` — understand the codebase structure and key files.

## Main Loop

Repeat until all bugs are handled:

### 1. Poll for new bugs
```bash
cat /home/caleb/projects/task-toad/.ai/bugs/bugs.json | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const open = d.bugs.filter(b => b.status === 'new' || b.status === 'investigating');
if (open.length === 0) { console.log('NO_BUGS'); process.exit(0); }
open.forEach(b => console.log(b.id, b.severity.padEnd(10), b.title.slice(0,60)));
"
```

If `NO_BUGS`, wait 30 seconds and check again. After 3 consecutive empty polls, report to the user that testing may be complete.

### 2. Pick the highest-severity unhandled bug
Priority: critical > high > medium > low. Within same severity, pick oldest first.

### 3. Claim it
Update the bug's `status` to `"investigating"` and add `"assignee": "debugger-1"` in bugs.json.

### 4. Investigate

**Reproduce first.** Run the exact steps/curl commands from the bug report. Verify you see the same error.

**Then trace the root cause:**
- For GraphQL errors: check `apps/api/src/graphql/typedefs/` for the schema definition, then `resolvers/` for the implementation
- For "Cannot query field" errors: the frontend calls a mutation/query that doesn't exist in the API schema. Check `apps/web/src/api/queries.ts` for what the frontend expects, compare with typedefs.
- For runtime errors: check resolver logic, Prisma queries, AI service calls
- For auth errors: check `apps/api/src/graphql/context.ts` and resolver auth guards
- For data errors: check Prisma schema relations and DataLoader implementations

### 5. Decide: Fix or Document

**Fix directly if:**
- The fix is < 50 lines of code
- It's a clear bug (missing resolver, wrong field name, broken query)
- You can verify the fix with a curl test
- It doesn't require a database migration

**Document only if:**
- The fix is complex (architectural change, new feature needed)
- It requires a migration (coordinate with user)
- You're unsure of the intended behavior
- It's a design decision, not a bug

### 6. If fixing:

1. Make the code change
2. Run validation:
   ```bash
   pnpm typecheck && pnpm lint && pnpm build
   ```
3. Test the fix by re-running the reproduction steps from the bug report
4. Commit with conventional format:
   ```
   fix(<scope>): <description>

   Fixes bug-XXX: <bug title>

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   ```
5. Update the bug in bugs.json:
   ```json
   {
     "status": "fixed",
     "resolution": "Description of what was fixed and why",
     "commit": "abc1234"
   }
   ```

### 7. If documenting:

1. Add entry to `.claude-knowledge/errors.md` using the standard format
2. Update the bug in bugs.json:
   ```json
   {
     "status": "documented",
     "resolution": "Description of the issue and why it needs manual attention",
     "documentedIn": "errors.md"
   }
   ```

### 8. Move to next bug

Go back to step 1.

## Rules

- **Always reproduce before fixing.** Don't assume the bug report is accurate.
- **Don't fix what isn't broken.** If you can't reproduce it, mark as `"cannot-reproduce"` with your reproduction attempt details.
- **Small fixes only.** If a fix touches > 5 files or needs a migration, document it and move on.
- **Validate every fix.** `pnpm typecheck && pnpm lint && pnpm build` must pass before committing.
- **Test your fix.** Re-run the bug's reproduction steps after your code change.
- **Don't modify bugs.json structure.** Only update individual bug entries (status, resolution, assignee, commit).
- **Document patterns.** If you see the same category of bug repeatedly (e.g., frontend calling non-existent mutations), note the pattern in errors.md so it can be prevented.
- **Never push.** Commit locally. The user reviews and pushes.

## Bug Status Lifecycle

```
new → investigating → fixed|documented|cannot-reproduce|wont-fix
```

- `new` — reported by tester, not yet picked up
- `investigating` — debugger is working on it
- `fixed` — code change committed, bug resolved
- `documented` — added to errors.md, needs manual/architectural fix
- `cannot-reproduce` — debugger couldn't reproduce with given steps
- `wont-fix` — by design, not a bug, or too low priority
