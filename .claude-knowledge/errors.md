# Error Log

Running log of errors encountered and their resolutions.

---

## Template

```
### [Date] — Short description
**Context:** What was being done
**Error:** The error message or symptom
**Cause:** Root cause
**Fix:** What resolved it
```

---

### 2026-03-12 — Migration agent changed DB port to 5433, wiping user accounts
**Context:** Subagent ran `prisma migrate dev` but port 5432 was occupied by another project's container at the time
**Error:** Login returned "Invalid email or password" — no users existed in the new DB
**Cause:** Agent started a fresh `tasktoad-db` container on port 5433 and updated `.env` accordingly. All previously created accounts were in the old DB.
**Fix:** Stop & remove the 5433 container, start a new one on 5432, update `.env` back to 5432, run `prisma migrate deploy` to apply all migrations. Re-signup required.
**Rule for agents:** Always use `npx prisma migrate dev` against the existing DB. Never start a new Docker container or change the DATABASE_URL port — if 5432 is occupied, investigate first.

---

### 2026-03-12 — useBlocker must be used within a data router
**Context:** Added `useBlocker(isGenerating)` to ProjectDetail to block navigation during AI generation
**Error:** `useBlocker must be used within a data router. See https://reactrouter.com/v6/routers/picking-a-router`
**Cause:** `useBlocker` requires `createBrowserRouter` / `RouterProvider` (data router API). TaskToad uses `<BrowserRouter>` which is the legacy router.
**Fix:** Replaced `useBlocker` with a `popstate` event listener that pushes a duplicate history entry, intercepts back/forward with `window.confirm`, and aborts the in-flight request if the user confirms. `beforeunload` handles tab close/refresh.
**Rule:** Do not use `useBlocker` or `unstable_usePrompt` with `<BrowserRouter>`. Use `popstate` + `beforeunload` instead.

---

### 2026-03-11 — "AI service error" on client
**Context:** User triggered an AI mutation (generateProjectOptions, generateTaskPlan, etc.)
**Error:** Client showed generic "AI service error" with no useful detail
**Cause:** `callAI()` in `ai.ts` caught all errors and rethrew a single generic `GraphQLError('AI service error')`, swallowing the real cause (invalid API key, rate limit, network failure, etc.)
**Fix:** Added specific handling for `Anthropic.AuthenticationError`, `RateLimitError`, `APIConnectionError`, `InternalServerError` — each with a descriptive message and error code extension. Unknown errors still fall through to the generic message but are `console.error`'d for debugging.
