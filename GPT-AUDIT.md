# Deep Repository Audit

## Executive Summary
This is a serious, ambitious MVP codebase, not a toy. It shows real product thinking, meaningful feature depth, and several signs of senior engineering judgment, but it is not production-ready. A strong senior team could inherit it, but they would want to harden security boundaries, simplify the main UX surface, resolve deployment ambiguity, and invest in testing before trusting it with real customer traffic.

Maturity level is best described as `advanced MVP / internal-tool-plus`, not production-bound SaaS. Execution quality is mixed: parts of the backend architecture and some frontend interaction work feel mid-to-senior, while other areas still carry fast-moving MVP shortcuts that would concern a CTO or staff engineer during diligence.

This feels:
- `Portfolio-ready` with caveats
- `MVP-ready` for controlled usage
- `Not production-ready` yet

Top 5 strengths:
- The product thesis is coherent: AI-assisted project/task planning with collaboration, sprints, GitHub, Slack, and reporting is visible across both the frontend and backend in `apps/web/src` and `apps/api/src`.
- The backend is not a monolith-by-accident; GraphQL typedefs and resolvers are domain-split in `apps/api/src/graphql/typedefs` and `apps/api/src/graphql/resolvers`, with `DataLoader` support in `apps/api/src/graphql/loaders.ts`.
- There are real platform instincts present: structured logging in `apps/api/src/utils/logger.ts`, Sentry setup in `apps/api/src/index.ts`, metrics in `apps/api/src/utils/metrics.ts`, rate limiting and schema guards in `apps/api/src/app.ts` and `apps/api/src/graphql/schema.ts`.
- CI is better than average for an MVP: lint, typecheck, unit tests, integration tests with Postgres, and build all run in `.github/workflows/ci.yml`.
- Some frontend craftsmanship is genuinely good: modal focus trapping in `apps/web/src/components/shared/Modal.tsx`, keyboard-movable kanban cards in `apps/web/src/components/KanbanBoard.tsx`, and a clean auth/app route split in `apps/web/src/App.tsx`.

Top 5 concerns:
- Multi-tenant authorization is not consistently enforced in task assignment, custom fields, comments, and automation paths in `apps/api/src/graphql/resolvers/task.ts` and `apps/api/src/utils/automationEngine.ts`.
- The upload/attachment system is not safe or scalable for production: `apps/api/src/routes/upload.ts` writes to local disk, trusts MIME type, and serves files `inline`.
- Background work is process-local and interval-driven in `apps/api/src/index.ts`, `apps/api/src/utils/webhookDispatcher.ts`, and `apps/api/src/utils/recurrenceScheduler.ts`, which will duplicate work in multi-replica deployments.
- The deployment story is still ambiguous because the active Railway/Postgres/Express path coexists with stale AWS CDK infrastructure code in `infra/lib/task-toad-stack.ts`. Since AWS is not in use, this is dead or legacy infrastructure that should be removed or clearly archived.
- The main product surface has become a frontend orchestration hotspot: `apps/web/src/pages/ProjectDetail.tsx` and `apps/web/src/hooks/useProjectData.ts` are carrying too much responsibility.

## Overall Scorecard
- Product clarity: `6/10`  
  The core intent is understandable, but the product has expanded faster than the UX and navigation model.
- Architecture: `6/10`  
  Good domain decomposition on the backend, but frontend orchestration and deployment consistency drag this down.
- Code quality: `6/10`  
  Many files are readable and purposeful, but standards are uneven and some hotspots are overgrown.
- Frontend/UX: `5/10`  
  There are good primitives and interactions, but major flows are overloaded, inconsistent, and partially unfinished.
- Backend/API: `6/10`  
  Solid structure for an MVP, but authz, layering, and integration safety need work.
- Security: `4/10`  
  There are basic controls, but several concrete risks should block production rollout.
- Testing: `4/10`  
  Backend has some meaningful tests, but frontend and end-to-end confidence are far too thin for the scope.
- DevOps/reliability: `4/10`  
  CI exists, but deployment automation, job execution model, and infra clarity are not where they need to be.
- Scalability: `5/10`  
  Fine for low-volume MVP use, but current async/job/runtime patterns will create pain as soon as the app grows.
- Documentation: `6/10`  
  Better than many MVPs, but contradicted by stale or divergent infra/runtime assumptions.
- Overall confidence to ship: `4/10`  
  Shippable to a controlled beta with close oversight; not comfortable for real production commitments.

## Detailed Findings
### 1. Multi-Tenant Authorization Boundaries Are Incomplete
- Severity: `Critical`
- Area: `Security / Backend`
- Why it matters: This is the most dangerous class of production bug in a multi-tenant app. If org/resource boundaries are inconsistent, users can attach the wrong users or metadata to tasks, and admins may act on resources that were not fully validated against tenant ownership.
- Evidence from the codebase: `apps/api/src/graphql/resolvers/task.ts` updates `assigneeId` directly in `updateTask`, upserts assignees in `addTaskAssignee`, removes them in `removeTaskAssignee`, and upserts custom field values in `setCustomFieldValue` without verifying the target user or field belongs to the same org/project as the task. `deleteComment` checks ownership/admin role but does not validate tenant ownership of the comment. `apps/api/src/utils/automationEngine.ts` can execute `assign_to` by blindly updating `assigneeId`.
- Recommended fix: Add centralized tenant-aware validators for `task + target user`, `task + custom field`, and `comment + org/project`; enforce them in all mutations and automation actions. Add regression tests specifically for cross-org and cross-project misuse.
- Priority: `Now`

### 2. Attachment Handling Is Unsafe And Not Production-Grade
- Severity: `High`
- Area: `Security / DevOps / Backend`
- Why it matters: File handling is a classic breach and outage surface. The current design risks stored XSS/scriptable content exposure, breaks on stateless deployments, and makes scaling/storage management harder.
- Evidence from the codebase: `apps/api/src/routes/upload.ts` stores uploads on local disk under `uploads/`, uses `file.originalname`, persists the client-provided MIME type, and serves files back with `Content-Type` from the database and `Content-Disposition: inline`. `apps/web/src/components/TaskDetailPanel.tsx` opens attachments in a new tab through `/api/uploads/:attachmentId`.
- Recommended fix: Move attachments to object storage, inspect/whitelist file types server-side, default to download disposition for risky types, sanitize filenames, and add malware/content scanning if this will handle external customer uploads.
- Priority: `Now`

### 3. Background Jobs Will Duplicate Or Race In Multi-Replica Production
- Severity: `High`
- Area: `DevOps / Reliability / Architecture`
- Why it matters: Once you deploy more than one API process, reminders, retries, and recurrence creation can happen multiple times. That creates duplicate notifications, duplicate recurring tasks, and replay storms.
- Evidence from the codebase: `apps/api/src/index.ts` starts due date reminders with `setInterval`, webhook retries via `startRetryProcessor`, and recurrence creation via `startRecurrenceScheduler`. The processors in `apps/api/src/utils/webhookDispatcher.ts` and `apps/api/src/utils/recurrenceScheduler.ts` have no leader election, distributed lock, or queue semantics.
- Recommended fix: Move all recurring/background work to a dedicated worker or queue-backed scheduler with idempotency guarantees and explicit ownership. At minimum, add DB locking or lease-based coordination.
- Priority: `Now`

### 4. Stale AWS Infrastructure Code Is Creating Operational Ambiguity
- Severity: `High`
- Area: `DevOps / Documentation / Architecture`
- Why it matters: Even if AWS is not in use, keeping dead infrastructure code that models a completely different runtime makes onboarding, deployment decisions, and technical due diligence harder. It makes the repo look less trustworthy than the actual app.
- Evidence from the codebase: `DEPLOY.md` and `railway.toml` describe a Railway/Postgres/Express deployment. `.github/workflows/deploy.yml` does not deploy anything and only echoes a placeholder. Root `package.json` still defines `pnpm deploy` as `pnpm --filter infra cdk deploy`. `infra/lib/task-toad-stack.ts` provisions Cognito, DynamoDB, Lambda, and API Gateway, while the real app uses JWT, Prisma, PostgreSQL, and Express and does not export a Lambda handler from `apps/api/src/index.ts`.
- Recommended fix: Since AWS is not your deployment path, remove `infra/` from active scripts and docs, archive or delete the CDK stack, and make Railway the single documented and automated deployment path.
- Priority: `Now`

### 5. The Main Frontend Work Surface Has Become A God Object
- Severity: `High`
- Area: `Frontend / Architecture`
- Why it matters: This is where 3-6 month maintainability pain accumulates. Every feature addition to the project page increases regression risk, onboarding difficulty, and UI inconsistency.
- Evidence from the codebase: `apps/web/src/pages/ProjectDetail.tsx` carries view switching, filters, bulk actions, exports, sprint workflows, GitHub setup, AI generation, templates, bug parsing, PRD breakdown, reports, modal orchestration, and toast handling. `apps/web/src/hooks/useProjectData.ts` aggregates project loading, task CRUD, sprint management, AI workflows, navigation interception, and local persistence.
- Recommended fix: Split the page into route-level feature modules or a page controller plus feature slices. Introduce a client-side query/cache layer and move network orchestration out of the page component.
- Priority: `Next`

### 6. AI Prompt And Response Logging Creates A Real Privacy And Retention Risk
- Severity: `High`
- Area: `Security / Product / Data`
- Why it matters: If customers put proprietary requirements, code, or incident data into prompts, raw prompt/response retention becomes a compliance, trust, and breach-scope issue.
- Evidence from the codebase: `apps/api/src/ai/aiClient.ts` stores up to 10,000 chars of prompt input and output in `AIPromptLog`. `apps/api/prisma/schema/aiusage.prisma` persists `input` and `output` as text with no retention, redaction, or consent controls visible in the code.
- Recommended fix: Make prompt logging opt-in or admin-configurable, add retention windows and deletion paths, redact obvious secrets, and document the data handling policy in-product and in docs.
- Priority: `Now`

### 7. Auth And Session Handling Are Still MVP-Grade
- Severity: `Medium`
- Area: `Security / Product`
- Why it matters: These choices are acceptable for a prototype, but not for a serious production app handling real customer data.
- Evidence from the codebase: `apps/web/src/auth/context.tsx` stores the JWT in `localStorage`. `apps/api/src/graphql/resolvers/auth.ts` allows `login` without checking `emailVerifiedAt`. `apps/api/prisma/schema/auth.prisma` stores verification/reset/invite tokens in plaintext. `apps/api/src/utils/email.ts` makes verification links non-expiring. `apps/web/src/pages/Signup.tsx` claims stronger password requirements than the backend actually enforces in `apps/api/src/graphql/resolvers/auth.ts`.
- Recommended fix: Enforce verified-email login if that is a product requirement, hash or otherwise protect reset/verification tokens, add expirations consistently, move to more secure session handling if this becomes an internet-facing product, and align UI claims with actual password policy.
- Priority: `Now`

### 8. UX Navigation And Surface Integration Are Inconsistent
- Severity: `Medium`
- Area: `Product / Frontend / UX`
- Why it matters: The product feels broader than its navigation model. That lowers perceived polish and makes the app look less intentional than the implementation effort actually is.
- Evidence from the codebase: `apps/web/src/pages/Search.tsx` navigates task hits to `/app/projects/:projectId?task=:taskId`, but no code in `apps/web/src` reads the `task` query param. `apps/web/src/App.tsx` defines `/app/portfolio`, but `apps/web/src/pages/AppLayout.tsx` does not surface it in navigation. `apps/web/src/pages/Home.tsx` acts like an AI-first project creator while the rest of the app behaves like a broader PM platform, which creates product-positioning tension.
- Recommended fix: Decide the primary product story, align navigation to it, either wire task deep-linking properly or remove it, and expose or intentionally retire orphaned features like `Portfolio`.
- Priority: `Next`

### 9. Observability And Runtime Hygiene Are Only Partially Realized
- Severity: `Medium`
- Area: `DevOps / Backend / Maintainability`
- Why it matters: This is the difference between “we have monitoring” and “we can actually debug production.”
- Evidence from the codebase: `apps/api/src/utils/metrics.ts` defines resolver and Prisma pool metrics that are not clearly populated anywhere. Multiple separate `new PrismaClient()` instances exist across routes, webhook handlers, GitHub code, context, and app startup. `railway.toml` healthchecks `/`, while the real dependency-aware health endpoint is `/api/health`.
- Recommended fix: Centralize Prisma client lifecycle, wire only metrics that are actually emitted, add request correlation through more subsystems, and point health checks at a meaningful readiness endpoint.
- Priority: `Next`

### 10. Test Coverage Is Not Proportional To Product Scope
- Severity: `High`
- Area: `Testing / QA`
- Why it matters: This product has enough scope and enough hidden coupling that shipping without broad automated coverage will force expensive manual QA and still miss regressions.
- Evidence from the codebase: The backend has useful integration tests in `apps/api/src/__tests__`, but they are mostly happy-path and do not cover the highest-risk authorization boundaries. The web app has essentially one test file in `apps/web/src/__tests__/useTaskFiltering.test.ts`. No Playwright or Cypress suite exists, and no coverage artifacts/configuration were found.
- Recommended fix: Add end-to-end coverage for signup/login/org creation/project creation/task flows, cross-tenant authz tests, upload safety tests, and GitHub/AI critical-path smoke tests. Add coverage reporting to CI.
- Priority: `Now`

## What Senior Reviewers Would Say
- Staff Engineer: “There’s real substance here. The backend is trying to be principled, and some of the frontend interaction work is better than average. But the main workflow is carrying too much logic, and your permission model is not rigorous enough for multi-tenant SaaS.”
- CTO: “I’d see product ambition and decent engineering instincts, but I would not let this go to production before clarifying deployment, fixing authz gaps, and hardening the async/runtime model. The foundation is usable, but not yet trustworthy.”
- Product Lead: “The app is trying to do too many things at once. The core value is there, but reporting, portfolio, AI planning, codegen, GitHub, Slack, and automation are competing for attention without a single clean user journey.”
- Security Engineer: “The biggest issue is not theoretical. The tenant boundary checks are inconsistent, uploads are risky, tokens are handled in MVP-style ways, and prompt logging needs a privacy story.”
- DevOps Lead: “CI is decent, but production operations are not. Background work should not be tied to the API process, and stale AWS infrastructure should not remain in the active toolchain if Railway is the real path.”
- UX Lead: “There are good pieces here, especially around modals and keyboard support, but the interface hierarchy is muddy. `ProjectDetail` feels like a product backlog dumped into one screen.”

## Technical Debt Register
| Item | Severity | Impact | Effort | Suggested owner type | Recommended timing |
|---|---|---:|---:|---|---|
| Centralize tenant-aware authz checks for task/comment/custom-field/assignee paths | Critical | Very high | Medium | Backend engineer / security-minded staff | Now |
| Replace local-disk attachment pipeline with safe object storage flow | High | High | Medium | Backend + platform | Now |
| Move reminders/retries/recurrence to worker/queue model | High | High | Medium | Platform / backend | Now |
| Remove stale AWS deploy path from scripts/docs/tooling | High | High | Low | CTO / platform lead | Now |
| Refactor `ProjectDetail` and `useProjectData` into feature slices | High | High | High | Frontend lead | Next |
| Add e2e suite for core user journeys | High | High | Medium | QA / full-stack | Now |
| Add authz regression tests for cross-org misuse | High | High | Medium | Backend engineer | Now |
| Add AI prompt retention/redaction controls | High | Medium | Medium | Backend + product/security | Now |
| Centralize Prisma client lifecycle | Medium | Medium | Low | Backend engineer | Next |
| Wire real resolver/DB pool metrics or remove dead metrics | Medium | Medium | Low | Platform / backend | Next |
| Fix task deep-link handling and portfolio navigation exposure | Medium | Medium | Low | Frontend/product | Next |
| Align password policy UX with backend enforcement | Medium | Low | Low | Frontend + backend | Now |

## Production Readiness Gaps
- Cross-tenant/resource authorization is not consistently enforced.
- Upload storage and serving are not safe for production use.
- Background job execution is not safe under horizontal scaling.
- Deployment automation is not actually implemented in CI/CD.
- The repository still contains stale infrastructure/tooling that points to a non-active AWS path.
- End-to-end confidence is missing for the core customer journey.
- AI data retention policy is not visibly defined or enforced.
- Auth/session hardening is incomplete for a real SaaS environment.
- Observability is partial and some declared metrics are not operational.
- Frontend critical path complexity is high enough to make regressions likely.

## Portfolio / Hiring Manager Impression
- Senior engineering interviewers would be impressed by the breadth, the real product shape, the domain-split backend, and the presence of logging/metrics/tests/CI. They would be concerned that the repo overreaches without fully closing the loop on security, runtime reliability, and UI coherence.
- Hiring managers would likely see this as stronger than most portfolio projects because it is clearly a real application, not a tutorial clone. Confidence would drop when they notice stale infra paths, thin frontend tests, and overloaded main screens.
- Startup founders / CTOs would appreciate the ambition and speed. They would worry about whether the team has the discipline to stop adding features and harden the core.
- Potential collaborators / open source reviewers would see evidence of serious effort and product intuition. They would hesitate if they sensed there is no clear roadmap for simplifying and stabilizing the foundation.

What would impress them:
- Real SaaS complexity
- AI/GitHub/Slack integration ambition
- Domain-structured backend
- Thoughtful UX details in some interactive components
- Real CI and integration test scaffolding

What would weaken confidence:
- Security boundaries not fully hardened
- Inconsistent deployment/infrastructure story
- Sparse frontend and e2e testing
- Feature sprawl around a stressed core workflow
- Operational patterns that will fail at scale

## 30 / 60 / 90 Day Improvement Plan
### 30 Days
- Fix all confirmed authz gaps in `task.ts`, `automationEngine.ts`, and adjacent resolver paths.
- Replace or lock down the upload system: file-type validation, safe serving behavior, and storage abstraction.
- Remove AWS/CDK from active docs/scripts if Railway is the real path.
- Implement actual deploy automation in `.github/workflows/deploy.yml`.
- Add authz regression tests and at least one end-to-end happy path for signup -> org -> project -> task -> sprint.
- Enforce or clarify email verification and align password policy with the UI.

### 60 Days
- Break `ProjectDetail.tsx` into feature-level modules and introduce a client-side query/cache strategy.
- Introduce a service/policy layer for backend business rules instead of resolver-local enforcement.
- Move webhooks/retries/reminders/recurrence into a queue or worker model.
- Add AI prompt retention controls, redaction, and admin visibility into what is stored.
- Improve navigation coherence: portfolio visibility, task deep-link support, clearer primary journeys.

### 90 Days
- Expand e2e and integration coverage across GitHub, Slack, uploads, automation, and notifications.
- Harden observability: real resolver metrics, DB pool visibility, alertable health/readiness semantics.
- Add production runbooks, architecture docs, and failure-mode documentation.
- Polish UX consistency across loading, empty, and error states.
- Review scalability bottlenecks from real usage data and optimize the highest-cost paths.

## Immediate Actions
1. Fix task/comment/custom-field/assignee authorization gaps.
2. Replace or harden the attachment upload/serve pipeline.
3. Remove in-process schedulers from the API runtime or add distributed coordination immediately.
4. Remove stale AWS/CDK deployment references and make Railway the single source of truth.
5. Add authorization-focused backend integration tests.
6. Add at least one end-to-end test for the main customer journey.
7. Decide and implement an AI prompt retention/redaction policy.
8. Enforce or intentionally relax email verification and password policy consistently.
9. Start decomposing `ProjectDetail` and `useProjectData` before adding more features there.
10. Fix confirmed UX inconsistencies like broken task deep-linking and hidden/orphaned routes.

## Brutally Honest Bottom Line
This looks like a product built by a team with real ambition and decent engineering range, but not yet enough operational and architectural discipline to claim production readiness. The evidence suggests mixed-level execution: likely one or more strong engineers driving architecture and feature breadth, with MVP shortcuts left in place longer than they should have been.

The biggest hidden risk is the multi-tenant authorization model. That is the kind of issue that does not just cause bugs; it damages trust.

The biggest opportunity is that the repo already has a credible product core and enough structure to improve without a rewrite. This is not a “throw it away” codebase. It is a “stop expanding, harden the foundation, and simplify the hotspots” codebase.

If I were a CTO inheriting this, I would continue on this foundation, but I would refactor key portions first before scaling customers or team size. I would not replatform the whole app. I would harden security boundaries, unify deployment, move background work out of process, and reduce the complexity concentration in the main frontend workflow.

The single most important next move is to pause feature expansion and do a focused production-hardening sprint on authz, uploads, deployment truth, background job architecture, and test coverage.
