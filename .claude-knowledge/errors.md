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
