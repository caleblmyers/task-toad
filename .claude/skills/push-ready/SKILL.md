---
name: push-ready
description: Verify the codebase is safe to push — run all validation checks and show what commits will be pushed. Use when the user asks "am I ready to push", "can I push", "verify build", or "check before push".
disable-model-invocation: false
user-invocable: true
---

# Push Readiness Check

Verify that the current main branch is safe to push to remote.

## Run All Checks

Execute these in parallel where possible:

1. **Prisma validation:**
```bash
cd apps/api && npx prisma validate
```

2. **TypeScript typecheck (all packages):**
```bash
pnpm typecheck
```

3. **Production build:**
```bash
pnpm build
```

4. **Lint:**
```bash
pnpm lint
```

## Check Git State

5. **Working tree clean:**
```bash
git status
```
If dirty, warn the user — they may have uncommitted changes.

6. **Commits to push:**
```bash
git log --oneline origin/main..HEAD
```

7. **Any active worktrees** that shouldn't be there:
```bash
git worktree list
```

## Report

Format the output clearly:

```
## Push Readiness

| Check | Status |
|-------|--------|
| Prisma validate | ✓ Pass / ✗ FAIL |
| TypeScript | ✓ Pass / ✗ FAIL |
| Build | ✓ Pass / ✗ FAIL |
| Lint | ✓ Pass / ✗ FAIL |
| Working tree | ✓ Clean / ⚠ Dirty |
| Worktrees | ✓ Clean / ⚠ Active |

### Commits to push (N):
[list of commit messages]

### Verdict
✓ Safe to `git push` — all checks pass
OR
✗ NOT safe to push — [specific failures listed]
```

If any check fails, describe the specific error so the user can fix it.
Do NOT attempt to fix issues yourself — just report them.
