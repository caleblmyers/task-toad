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

### 2026-03-14 — GitHub App auth fails: PKCS#1 vs PKCS#8 key format
**Context:** GitHub App integration — listing repos, creating PRs, all token-authenticated operations
**Error:** `"pkcs8" must be PKCS#8 formatted string` or `error:1E08010C:DECODER routines::unsupported`
**Cause:** GitHub generates PKCS#1 private keys (`BEGIN RSA PRIVATE KEY`) but `jose`'s `importPKCS8` only accepts PKCS#8 (`BEGIN PRIVATE KEY`). Additionally, multi-line PEM values in `.env` are not parsed correctly by Node/tsx — only the first line is read.
**Fix:** (1) Added `toPKCS8()` using `crypto.createPrivateKey` to convert PKCS#1 → PKCS#8. (2) Base64-encode the private key in `.env` as a single line — `getPrivateKeyPem()` already decodes base64.
**Files:** `apps/api/src/github/githubAppAuth.ts`, `apps/api/.env`

---

### 2026-03-14 — GitHub webhook signature verification always fails
**Context:** GitHub App installed, ngrok tunnel running, webhooks being delivered but no installations appearing in DB
**Error:** All webhooks return 401 (invalid signature). No `GitHubInstallation` records created.
**Cause:** `express.json()` middleware was registered globally before the webhook route. By the time `handleGitHubWebhook` ran, `req.body` was a parsed JS object. `JSON.stringify(parsed)` doesn't reproduce the exact bytes GitHub signed (whitespace/key order differ), so HMAC always failed.
**Fix:** Register the webhook route with `express.raw({ type: 'application/json' })` before the global `express.json()` middleware. Handler receives raw `Buffer`, converts to string for signature verification.
**Files:** `apps/api/src/app.ts`, `apps/api/src/github/githubWebhookHandler.ts`

---

### 2026-03-11 — "AI service error" on client
**Context:** User triggered an AI mutation (generateProjectOptions, generateTaskPlan, etc.)
**Error:** Client showed generic "AI service error" with no useful detail
**Cause:** `callAI()` in `ai.ts` caught all errors and rethrew a single generic `GraphQLError('AI service error')`, swallowing the real cause (invalid API key, rate limit, network failure, etc.)
**Fix:** Added specific handling for `Anthropic.AuthenticationError`, `RateLimitError`, `APIConnectionError`, `InternalServerError` — each with a descriptive message and error code extension. Unknown errors still fall through to the generic message but are `console.error`'d for debugging.

---

### 2026-03-17 — planCodeGeneration / generatePlannedFile mutations don't exist (dead frontend code)
**Context:** QA tester clicked "Plan & Generate Code" button in TaskDetailPanel
**Error:** `Cannot query field "planCodeGeneration" on type "Mutation"`
**Cause:** Frontend defines `PLAN_CODE_MUTATION` and `GENERATE_PLANNED_FILE_MUTATION` in `queries.ts` (lines 149-161), with handlers in `useAIGeneration.ts` (lines 196-312). But neither mutation was ever added to the API typedefs or resolvers.
**Workaround:** The simpler `generateCodeFromTask` mutation works for single-call code generation.
**Fix needed:** Either implement the two mutations in the API (typedefs/ai.ts + resolvers/ai.ts + new AI service functions), or remove the dead frontend code and the "Plan & Generate Code" button. Implementation requires: new AI prompts for architecture planning, file-by-file generation with export context threading, and new GraphQL types (CodePlan, CodePlanFile).

---

### 2026-03-20 — Unapplied migrations break time tracking, saved filters, and capacity features
**Context:** QA testing discovered multiple features failing with Prisma errors
**Error:** `The table public.time_entries does not exist` / `The column is_shared does not exist`
**Cause:** Three migrations were added but never applied to the running database:
- `20260320000000_add_time_entries` — creates `time_entries` table
- `20260320010000_extend_saved_filter_to_view` — adds `is_shared`, `view_type`, `sort_by`, `sort_order`, `group_by`, `visible_columns`, `is_default` columns to `saved_filters`
- `20260320020000_add_user_capacity` — creates `user_capacities` and `user_time_off` tables
Additionally, 3 orphaned DB-only migrations exist from a prior GitHub integration session.
**Fix:** Run `cd apps/api && npx prisma migrate deploy` to apply pending migrations. For the orphaned migrations, may need `prisma migrate resolve` to mark them as applied/rolled-back.
**Rule:** After adding new Prisma schema models/fields and generating migrations, always apply them to the dev DB before testing.

---

### 2026-03-20 — Intermittent HTTP 500 on GraphQL mutations (signup, login, updateTask)
**Context:** QA testers reported signup, login, and cross-tenant updateTask returning `{"error":"Internal server error"}` (HTTP 500) instead of proper GraphQL error responses. The error hits Express's global error handler (app.ts:360), bypassing yoga entirely.
**Error:** `{"error":"Internal server error"}` (HTTP 500) — intermittent, not consistently reproducible
**Symptoms:**
- signup for new users sometimes returns 500 instead of `{"data":{"signup":true}}`
- login with correct password sometimes returns 500 instead of AuthPayload or AuthenticationError
- cross-tenant updateTask sometimes returns 500 instead of NotFoundError
- Wrong-password login and duplicate-email signup return proper GraphQL errors most of the time
- The same request may succeed or fail depending on timing
**Investigation:**
- All resolver code is correct: ConflictError, AuthenticationError, NotFoundError all extend GraphQLError and are properly thrown
- Rate limiter returns 429 (not 500) when exhausted
- No duplicate `graphql` package (single copy at v16.13.1)
- graphql-yoga v5.18.1 maskedErrors defaults are reasonable
- 3 unapplied migrations exist but none modify the User table
- Likely caused by transient Prisma connection pool exhaustion under concurrent tester load, or tsx watch server reloading mid-request
**Workaround:** Retry the request. The issue is transient and self-resolves.
**Fix needed:** If this recurs in production, investigate:
1. Prisma connection pool settings (`connection_limit` in DATABASE_URL)
2. Add connection pool monitoring via the existing Prisma metrics preview feature
3. Consider adding a yoga `onError` plugin to catch and log errors that escape to Express
4. Review if `compression()` middleware (registered before yoga) could interfere with error response streaming
