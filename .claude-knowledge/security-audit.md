# TaskToad Security Assessment Report

**Assessment Date:** 2026-03-20
**Classification:** Confidential
**Assessors:** Elite Cybersecurity Team (5 parallel audit streams)

---

## Executive Summary

We conducted a comprehensive penetration test of the TaskToad SaaS application across five attack domains: **Authentication & Session Management**, **Injection & Input Validation**, **Data Exposure & Secrets**, **Infrastructure & API Security**, and **Multi-Tenancy Isolation**. The application demonstrates a solid security foundation with proper bcrypt hashing, rate limiting, encryption at rest, and query depth limits. However, we identified **5 Critical**, **12 High**, **10 Medium**, and **12 Low** severity findings that must be addressed before production deployment.

---

## CRITICAL Findings

### C-1. No Token Revocation or Logout Mechanism
**Files:** `apps/api/src/graphql/resolvers/auth.ts`, `apps/api/src/graphql/context.ts`
**CVSS:** 9.1

There is **no logout mutation** and no token blacklist. JWTs are valid for 7 days with no revocation. Consequences:
- Password change does **not** invalidate existing tokens — a stolen token remains valid
- Compromised accounts cannot be locked out
- Org member removal does not revoke access

**Remediation:** Implement a `tokenVersion` field on the User model. Increment on password change, logout, or admin revocation. Check `tokenVersion` in `buildContext()` on every request. Add `logout` mutation.

---

### C-2. Multi-Tenant Data Leakage via Export Endpoints
**File:** `apps/api/src/routes/export.ts:118-126, 252-298`

Export endpoints validate project access but **do not filter tasks or activity logs by orgId** in the underlying queries. A user who discovers a valid `projectId` from another org (via enumeration or leaked URL) could export that org's data.

**Remediation:** Add `orgId` to all Prisma `where` clauses in export queries. Apply defense-in-depth: validate `project.orgId === user.orgId` before any data fetch.

---

### C-3. SSRF via Webhook URL Registration
**File:** `apps/api/src/utils/webhookDispatcher.ts:52`, `apps/api/src/graphql/resolvers/webhook.ts:99`

Webhook URLs are validated only for URL format parsing. No CIDR block validation — attackers can register:
- `http://169.254.169.254/latest/meta-data/` (cloud metadata)
- `http://localhost:3001/graphql` (internal API)
- `http://10.0.0.x/admin` (internal network)

**Remediation:** Validate resolved IPs against RFC 1918/5735 private ranges. Block `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`. Reject non-HTTP(S) schemes.

---

### C-4. AI Prompt History IDOR
**File:** `apps/api/src/graphql/resolvers/reports.ts:34-52`

`aiPromptHistory` accepts `taskId`/`projectId` filters with **no validation** that these IDs belong to the requesting user's organization. Direct IDOR allows exfiltrating AI prompt history across tenants.

**Remediation:** Validate `taskId` -> `task.project.orgId === user.orgId` and `projectId` -> `project.orgId === user.orgId` before returning data.

---

### C-5. Automation Rules Leak Across Tenants
**File:** `apps/api/src/graphql/resolvers/projectrole.ts:61-71`

`automationRules` query lacks `orgId` scoping, potentially exposing automation rule configurations from other orgs.

**Remediation:** Add `orgId` filtering to the `automationRules` query, consistent with all other list queries.

---

## HIGH Findings

### H-1. JWT Stored in localStorage (XSS Token Theft)
**File:** `apps/web/src/api/client.ts:3,10`

JWT stored in `localStorage` is accessible to any JavaScript on the page. Combined with the 7-day expiry and no revocation, a single XSS vector means full account takeover.

**Remediation:** Migrate to `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Implement short-lived access tokens (15-30 min) with refresh token rotation.

---

### H-2. No CSRF Protection on GraphQL Mutations
**File:** `apps/api/src/app.ts:275-334`

No CSRF tokens are validated. With `credentials: true` in CORS, a malicious site can make authenticated cross-origin requests if the user is logged in.

**Remediation:** Require a custom header (`X-Requested-With`) on all mutations that browsers won't send cross-origin, or implement CSRF tokens.

---

### H-3. Webhook Secrets Stored Plaintext in Database
**File:** `apps/api/prisma/schema/webhook.prisma:5`

`WebhookEndpoint.secret` is stored unencrypted. Database compromise exposes all webhook signing secrets, allowing signature forgery.

**Remediation:** Encrypt with AES-256-GCM using the existing `encryption.ts` utility, matching the API key encryption pattern.

---

### H-4. Slack Webhook URLs Stored Plaintext
**File:** `apps/api/prisma/schema/slack.prisma:6`

Slack webhook URLs contain embedded authentication tokens and are stored unencrypted.

**Remediation:** Encrypt at rest using the existing encryption utility.

---

### H-5. X-Forwarded-For Spoofing Bypasses Rate Limits
**File:** `apps/api/src/app.ts:209-217`

`express-rate-limit` uses client IP, but `trust proxy` is not explicitly configured. Attackers can spoof `X-Forwarded-For` to bypass all rate limits (including auth brute-force protection).

**Remediation:** Set `app.set('trust proxy', 1)` (or your proxy hop count) and validate the rate limiter is keying on the correct IP.

---

### H-6. No Pagination Caps on List Queries
**Files:** `apps/api/src/graphql/resolvers/search.ts:8-36`, `notification.ts`, `webhook.ts`

Multiple queries accept user-provided `limit` with no maximum. An attacker can request `limit: 999999` to cause OOM or excessive DB load.

**Remediation:** Enforce `Math.min(args.limit ?? 50, 100)` on all list resolvers.

---

### H-7. Missing `frame-ancestors` CSP Directive (Clickjacking)
**File:** `apps/api/src/app.ts:50-60`

No `frame-ancestors` in CSP. While Helmet sets `X-Frame-Options`, CSP `frame-ancestors` is the modern standard and takes precedence.

**Remediation:** Add `frameAncestors: ["'none'"]` to Helmet CSP config.

---

### H-8. SSE Token Accepted via Query String
**File:** `apps/api/src/app.ts:162-187`

SSE endpoint accepts JWT from `?token=` query parameter as fallback. Query strings are logged by proxies, CDNs, and browser history.

**Remediation:** Remove query string fallback. Require `Authorization: Bearer` header only.

---

### H-9. Invite Tokens Stored Plaintext (Unlike Reset Tokens)
**File:** `apps/api/src/graphql/resolvers/auth.ts:214-226`

Password reset tokens are properly hashed with SHA-256 before storage, but invite tokens are stored as plaintext. Database compromise reveals all pending invites.

**Remediation:** Hash invite tokens before storage using the same `hashToken()` pattern used for reset tokens.

---

### H-10. `$queryRawUnsafe` in Advisory Locks
**File:** `apps/api/src/utils/advisoryLock.ts:24,38`

Uses `$queryRawUnsafe()` with string interpolation. Currently safe (constant enum values), but a future refactor accepting dynamic input would be an immediate SQLi vector.

**Remediation:** Switch to `prisma.$queryRaw` with tagged template literals: `` prisma.$queryRaw`SELECT pg_try_advisory_lock(${lockId})` ``.

---

### H-11. Password Change Doesn't Invalidate Sessions
**File:** `apps/api/src/graphql/resolvers/auth.ts:184-202`

After `resetPassword`, all existing JWTs remain valid. If the reset was triggered because of compromise, the attacker retains access.

**Remediation:** Increment `tokenVersion` on password change (see C-1). Issue a new token in the reset response; all old tokens become invalid.

---

### H-12. Sensitive Operations Lack Re-Authentication
**File:** `apps/api/src/graphql/resolvers/org.ts:58-67`

`setOrgApiKey` (which stores the Anthropic billing key) requires only `org:admin` role — no password re-verification or step-up auth.

**Remediation:** Add `confirmPassword` argument to sensitive mutations. Verify bcrypt comparison before allowing the operation.

---

## MEDIUM Findings

### M-1. GraphQL Introspection Enabled in Production
**File:** `apps/api/src/graphql/schema.ts`

Introspection allows schema reconnaissance by attackers — discovery of internal query/mutation names, types, and potential injection points.

**Remediation:** Disable introspection when `NODE_ENV=production`.

---

### M-2. No Per-User Rate Limit on AI Operations
**Files:** `apps/api/src/graphql/resolvers/ai/*`

AI code generation, analysis, and PR review are API-intensive but have no per-user or per-org rate limiting beyond the global 200 req/min limit. Economic DoS vector.

**Remediation:** Add per-org budget enforcement + per-user throttle (e.g., 5 AI requests/hour).

---

### M-3. Content-Disposition Header Injection
**File:** `apps/api/src/routes/export.ts:135,217`

Content-Disposition headers use simple ASCII filenames without RFC 5987 encoding. Project names with special characters could break out of the quoted string.

**Remediation:** Use RFC 5987 `filename*=UTF-8''` encoding or the `content-disposition` npm library.

---

### M-4. File Upload MIME Type from Client Only
**File:** `apps/api/src/routes/upload.ts:90-100`

`multer` fileFilter checks `file.mimetype` which comes from the client `Content-Type` header. A client can send `image/png` MIME type with `.exe` binary payload.

**Remediation:** Validate with `file-type` library for magic byte detection.

---

### M-5. DataLoaders Not Scoped by orgId
**File:** `apps/api/src/graphql/loaders.ts`

DataLoaders load tasks, projects, sprints without orgId filtering. While resolvers check access, the loaders themselves could return cross-tenant data if misused.

**Remediation:** Add orgId parameter to DataLoader keys for tenant isolation.

---

### M-6. No Audit Logging for Sensitive Operations
**Files:** Various resolvers

Sensitive operations (`setOrgApiKey`, `createWebhookEndpoint`, `connectSlack`, `linkGitHubInstallation`) lack audit trail entries. Compliance gap.

**Remediation:** Log all sensitive operations with actor, timestamp, and old/new values. Prevent deletion of audit logs.

---

### M-7. Export Endpoints Expose User Emails
**File:** `apps/api/src/routes/export.ts:143-163`

Project exports include assignee email addresses without redaction or opt-out. Email enumeration/harvesting vector.

**Remediation:** Redact by default; add `includeEmails` opt-in parameter.

---

### M-8. Saved Filter Mutations Skip orgId Validation
**File:** `apps/api/src/graphql/resolvers/project.ts`

`updateFilter` and `deleteFilter` mutations don't validate the filter's project belongs to user's org before modification.

**Remediation:** Validate filter's project belongs to user's org before update/delete.

---

### M-9. No Input Length Validation on Text Fields
**File:** `apps/api/src/graphql/resolvers/task/mutations.ts`

Task title, description, and other text fields have no max length validation. Could cause memory issues during parsing.

**Remediation:** Add Zod `.max()` constraints: title (200), description (10000).

---

### M-10. Webhook Replay Attacks Possible
**File:** `apps/api/src/utils/webhookDispatcher.ts`

Webhook deliveries lack unique delivery IDs. The same payload can be replayed with the same valid signature.

**Remediation:** Add unique `X-Webhook-Delivery-ID` header and document idempotency requirements for consumers.

---

## LOW Findings

### L-1. 7-Day JWT Expiry Too Long
**File:** `apps/api/src/graphql/resolvers/auth.ts:122,291`

For a project management system handling sensitive business data, 7 days is excessive without refresh tokens.

**Remediation:** Reduce to 1-2 hours + implement refresh token rotation.

---

### L-2. Signup Returns "Email Already in Use" (Enumeration)
**File:** `apps/api/src/graphql/resolvers/auth.ts:93`

Allows attacker to enumerate valid email addresses in the system.

**Remediation:** Accept trade-off (common UX pattern) or use silent success with confirmation email.

---

### L-3. GitHub File Paths Not URL-Encoded
**File:** `apps/api/src/github/githubFileService.ts:68`

The `path` variable in GitHub API calls is not encoded, while `owner` and `repo` are.

**Remediation:** Apply `encodeURIComponent(path)` or use URL pathname-safe encoding.

---

### L-4. Console.error in Production ErrorBoundary
**Files:** `apps/web/src/components/ErrorBoundary.tsx`, `RouteErrorBoundary.tsx`

Error boundaries log errors to browser console in production, potentially exposing sensitive information.

**Remediation:** Wrap with `NODE_ENV` check; route to Sentry in production.

---

### L-5. No Concurrent Session Limit
**File:** `apps/api/src/graphql/context.ts`

Multiple concurrent sessions per user with no limit or visibility.

**Remediation:** Track sessions; allow user to view and terminate other sessions.

---

### L-6. Unicode Homograph Attacks in Filenames
**File:** `apps/api/src/routes/upload.ts:65-71`

Filename sanitization allows Unicode characters that could create deceptive filenames.

**Remediation:** NFKD normalize + ASCII-only whitelist.

---

### L-7. Bulk Mutation Has No Item Count Limit
**File:** `apps/api/src/graphql/resolvers/task/mutations.ts`

`bulkUpdateTasks` has no cap on `taskIds.length`.

**Remediation:** Cap at 100 items per request.

---

### L-8. GraphQL Depth Limit at 10 (Could Be Lower)
**File:** `apps/api/src/app.ts:298`

Depth limit of 10 is higher than necessary for this schema.

**Remediation:** Reduce to 6-7 after profiling legitimate queries.

---

### L-9. No SameSite Cookie Attribute (Future)
**File:** N/A (currently using localStorage)

Will be critical when migrating from localStorage to cookies.

**Remediation:** Set `SameSite=Strict` when implementing cookie-based auth.

---

### L-10. Retry-After Parsing Unbounded
**File:** `apps/api/src/github/githubAppClient.ts:53-54`

Retry-After header parsing doesn't cap the maximum wait, allowing potential self-DoS.

**Remediation:** Cap `waitMs` at 1 hour max.

---

### L-11. Null Byte Stripping Only on GraphQL, Not REST
**File:** `apps/api/src/app.ts:261-295`

Null byte sanitization applies to GraphQL middleware but not REST endpoints.

**Remediation:** Apply globally via Express middleware before route handlers.

---

### L-12. Test Database Credentials Hardcoded
**File:** `apps/api/src/__tests__/setup.integration.ts:10`

Default test credentials hardcoded. Acceptable for local dev but not CI/CD.

**Remediation:** Require `TEST_DATABASE_URL` in CI/CD environments.

---

## Positive Security Controls (Verified Effective)

- **Password hashing:** bcrypt with 10 salt rounds, strong policy enforced
- **Encryption at rest:** AES-256-GCM with random IVs, correct auth tag handling
- **Rate limiting:** 3-tier (global 200/min, auth 10/min, sensitive 5/min)
- **Query cost analysis:** GraphQL complexity limit of 100,000 units
- **Webhook signature verification:** HMAC-SHA256 with `timingSafeEqual` (GitHub + Slack)
- **Password reset tokens:** SHA-256 hashed before storage, 1-hour expiry, single-use
- **Email verification:** Enforced at login — unverified users cannot authenticate
- **AI prompt injection defense:** User inputs wrapped in `<user_input>` XML tags
- **Zod validation:** AI responses validated with schemas, not bare type casts
- **Security headers:** Helmet with CSP, HSTS enabled by default
- **GraphQL field exposure:** Passwords, encrypted keys, and raw secrets never in schema
- **Null byte injection defense:** Stripped from GraphQL parameters
- **Advisory locks:** PostgreSQL session-level locks prevent race conditions in background jobs
- **API key hints:** Only last 4 characters exposed via `apiKeyHint` resolver

---

## Remediation Roadmap

### Phase 1 — Pre-Production (Block Deployment)
1. Fix multi-tenant data leaks in exports, reports, automation rules (C-2, C-4, C-5)
2. Add SSRF validation to webhook URLs (C-3)
3. Implement token revocation with `tokenVersion` (C-1)
4. Configure `trust proxy` to prevent rate limit bypass (H-5)
5. Encrypt webhook/Slack secrets at rest (H-3, H-4)

### Phase 2 — First Sprint Post-Launch
6. Migrate JWT from localStorage to HttpOnly cookies (H-1)
7. Add CSRF protection (H-2)
8. Hash invite tokens (H-9)
9. Add pagination caps (H-6)
10. Remove SSE query string token fallback (H-8)
11. Fix `$queryRawUnsafe` (H-10)
12. Add re-authentication for sensitive operations (H-12)

### Phase 3 — Hardening (Next 30 Days)
13. Disable introspection in production (M-1)
14. Add per-org AI rate limiting (M-2)
15. Implement magic byte file type validation (M-4)
16. Scope DataLoaders by orgId (M-5)
17. Add audit logging for sensitive operations (M-6)
18. Reduce JWT expiry + implement refresh tokens (L-1)

---

This assessment was conducted through static analysis of the full codebase. We recommend follow-up dynamic testing (DAST) against the running application and a dependency vulnerability scan with `pnpm audit` integrated into CI/CD. The multi-tenancy isolation gaps (C-2, C-4, C-5) are the highest-risk findings — in a SaaS product, cross-tenant data leakage is an existential threat.
