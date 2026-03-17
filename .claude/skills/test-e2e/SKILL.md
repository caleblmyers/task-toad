---
name: test-e2e
description: Run end-to-end smoke test of the full TaskToad pipeline. Tests signup, org creation, API key setup, AI project generation, code generation, and GitHub PR creation. Use when the user says "run e2e test", "test full flow", or "smoke test".
user-invocable: true
---

# E2E Smoke Test

Run the full TaskToad pipeline end-to-end using curl + jq against `http://localhost:3001`. Track results per-step and produce a report at the end.

## Setup

Initialize tracking variables:

```bash
RESULTS=""        # accumulated result lines
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TS=$(date +%s)
EMAIL="e2e-${TS}@test.tasktoad.dev"
PASSWORD="E2eTestPass1!"
TOKEN=""
ORG_ID=""
PROJECT_ID=""
TASK_ID=""
INSTALLATION_ID=""
GH_LINKED=false
API_BASE="http://localhost:3001"
```

Helper function for recording results — define this in bash and reuse it:

```bash
record() {
  local step="$1" status="$2" detail="$3"
  RESULTS="${RESULTS}\n| ${step} | ${status} | ${detail} |"
  if [ "$status" = "PASS" ]; then ((PASS_COUNT++)); fi
  if [ "$status" = "FAIL" ]; then ((FAIL_COUNT++)); fi
  if [ "$status" = "SKIP" ]; then ((SKIP_COUNT++)); fi
}
```

Helper for GraphQL calls — define and reuse:

```bash
gql() {
  local query="$1"
  local auth_header=""
  if [ -n "$TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer ${TOKEN}\""
  fi
  eval curl -s --max-time 120 "$API_BASE/graphql" \
    -H "'Content-Type: application/json'" \
    $auth_header \
    -d "'$query'"
}
```

**Important:** After each GraphQL call, check for errors with `echo "$RESPONSE" | jq -e '.errors' > /dev/null 2>&1`. If errors exist, extract the message with `echo "$RESPONSE" | jq -r '.errors[0].message'`.

## Phase 0: Preflight

1. Check API health: `curl -s --max-time 10 $API_BASE/api/health`
   - Verify response contains `"status":"ok"` and `"database":"connected"`
   - If fails → record FAIL, abort entire test
2. Verify `jq` is available: `which jq`
3. Check `ANTHROPIC_API_KEY` env var is set and non-empty
   - If missing → record FAIL, abort (AI calls will all fail without it)

Record results for each check.

## Phase 1: Account Setup

1. **Signup:**
```
mutation { signup(email: "${EMAIL}", password: "${PASSWORD}") }
```
Expected: `{ "data": { "signup": true } }`

2. **Login:**
```
mutation { login(email: "${EMAIL}", password: "${PASSWORD}") { token } }
```
Extract: `TOKEN=$(echo $RESPONSE | jq -r '.data.login.token')`

If login fails, abort — all subsequent steps require auth.

Record: email used, token obtained (yes/no).

## Phase 2: Org + API Key

1. **Create org:**
```
mutation { createOrg(name: "E2E Test ${TS}") { id name } }
```
Extract: `ORG_ID=$(echo $RESPONSE | jq -r '.data.createOrg.id')`

2. **Set API key:**
```
mutation { setOrgApiKey(apiKey: "${ANTHROPIC_API_KEY}") { id hasApiKey } }
```
Verify `hasApiKey` is `true`.

If org creation fails, abort — AI calls require an org with an API key.

Record: orgId, hasApiKey status.

## Phase 3: GitHub Installation (conditional)

1. **Query installations:**
```
query { githubInstallations { installationId accountLogin orgId } }
```

2. **Logic:**
   - If any installation has `orgId` matching our `ORG_ID` → use its `installationId`, set `GH_LINKED=true`
   - If any installation has `orgId: null` → link it:
     ```
     mutation { linkGitHubInstallation(installationId: "${INSTALL_ID}") { installationId orgId } }
     ```
     Set `GH_LINKED=true`
   - If no installations at all → record SKIP, set `GH_LINKED=false`, warn that Phase 7 will be skipped

Record: installationId or skip reason.

## Phase 4: AI Project Generation

**This is the first AI call — it costs tokens.**

1. **Generate options:**
```
mutation { generateProjectOptions(prompt: "A simple todo list web app with user authentication and task CRUD") { title description } }
```
Extract the first option's `title` and `description`.

2. **Create project from option:**
```
mutation { createProjectFromOption(prompt: "A simple todo list web app with user authentication and task CRUD", title: "${OPTION_TITLE}", description: "${OPTION_DESC}") { id name } }
```
Extract: `PROJECT_ID`

Record: number of options returned, chosen title, projectId.

## Phase 5: Task Plan

1. **Preview task plan:**
```
mutation { previewTaskPlan(projectId: "${PROJECT_ID}") { title description priority estimatedHours subtasks { title description } } }
```

2. **Commit first 3 tasks only** (token safety — full plans can be 10+ tasks):

Build the `tasks` input array from the first 3 preview results. Each task needs:
- `title`, `description`, `priority` from the preview
- `instructions: ""`, `suggestedTools: ""` (empty strings — instructions generated separately)
- `estimatedHours` from preview (or null)
- `dependsOn: []`, `subtasks` from preview (map to `{title, description}`)
- `acceptanceCriteria: null`

```
mutation { commitTaskPlan(projectId: "${PROJECT_ID}", tasks: [...first 3...]) { id title status } }
```

Extract: first task's `id` as `TASK_ID`.

Record: total previewed count, committed count (3), task titles.

## Phase 6: Generate Instructions + Code

1. **Generate instructions** (AI call):
```
mutation { generateTaskInstructions(taskId: "${TASK_ID}") { id title instructions } }
```
Verify `instructions` is non-empty.

2. **Generate code** (AI call):
```
mutation { generateCodeFromTask(taskId: "${TASK_ID}") { files { path content language description } summary estimatedTokensUsed } }
```
Extract: file count, file paths, token estimate.

Record: instruction length (chars), file count, file paths, estimated tokens.

## Phase 7: Create PR (if GitHub linked)

**Only if `GH_LINKED=true`:**

1. Build `files` input from Phase 6 code generation result (map to `{path, content}`).

2. **Create PR:**
```
mutation { createPullRequestFromTask(projectId: "${PROJECT_ID}", taskId: "${TASK_ID}", files: [...]) { number url title } }
```

Record: PR number, PR URL, repo name.

**If `GH_LINKED=false`:** Record SKIP with reason "No GitHub installation available".

## Phase 8: Results Report

### Console Output

Print a formatted summary:

```
## E2E Test Results — {timestamp}

| Step | Status | Details |
|------|--------|---------|
{all recorded results}

### Summary
- Passed: {PASS_COUNT}
- Failed: {FAIL_COUNT}
- Skipped: {SKIP_COUNT}

### Test Account
- Email: {EMAIL}
- Org ID: {ORG_ID}
- Project ID: {PROJECT_ID}
```

### File Report

Write a detailed markdown report to `.ai/e2e-test-results-{TS}.md` containing:
- Timestamp and test parameters (email, orgId, projectId)
- Full results table with all step details
- AI token usage estimate (from generateCodeFromTask response)
- PR URL (if created)
- Any errors with full error messages
- Pass/fail/skip counts

## Hard vs Soft Dependencies

**Abort if these fail** (all subsequent steps depend on them):
- Preflight (API not running)
- Login (no auth token)
- Org creation (no org for API key)
- API key setup (AI calls will fail)

**Skip gracefully if these fail** (other steps can still run):
- GitHub installation → skip Phase 7
- Any individual AI call → record FAIL but attempt remaining AI steps

## Phase 9: Document Findings

After the test run, review all failures, unexpected behaviors, and workarounds encountered. Update project knowledge files:

### Errors → `.claude-knowledge/errors.md`

For each **new failure or unexpected error** encountered during this test run, append an entry to `.claude-knowledge/errors.md` using the existing format:

```
### [Date] — Short description
**Context:** What was being done (e.g., "E2E test Phase 6 — generateCodeFromTask")
**Error:** The exact error message or symptom
**Cause:** Root cause (investigate if not obvious — check API logs, resolver code, typedef mismatches)
**Fix:** What resolved it (or "Unresolved — needs investigation" if you couldn't fix it)
```

**What to document:**
- GraphQL errors (missing fields, wrong types, schema mismatches like the `planCodeGeneration` incident)
- Auth/permission failures (token issues, org role problems)
- AI service errors (rate limits, API key issues, timeouts)
- Infrastructure issues (DB not running, port conflicts, missing env vars)
- Workarounds you applied to get past a failure (e.g., modified a query, used a different endpoint)

**What NOT to document:**
- Expected skips (e.g., GitHub not linked — that's by design)
- Transient network blips that self-resolve on retry
- Issues already documented in errors.md (check first to avoid duplicates)

### Patterns → `.claude-knowledge/skills.md`

If you discover a **reusable pattern or technique** during the test (e.g., a specific way to handle AI timeouts, a curl/jq trick for complex GraphQL responses), add it to `.claude-knowledge/skills.md`.

### Schema Gaps → report to user

If you find a **frontend mutation/query that doesn't exist on the API** (like the `planCodeGeneration` issue), flag it prominently in both the test report AND errors.md. These are critical bugs that break user-facing features.

## Notes

- All curl calls use `--max-time 120` (AI calls can be slow)
- Use `jq -r` for raw string output (no quotes)
- Escape JSON strings properly — titles/descriptions from AI may contain quotes
- The `generateProjectOptions` prompt is intentionally short to minimize token usage
- Only 3 tasks committed (not full plan) to save tokens
- Only 1 task gets instructions + code generated
- Always read `.claude-knowledge/errors.md` BEFORE the test run to avoid re-investigating known issues
- After documenting new findings, commit the updated knowledge files with `chore(docs): update error log from e2e test`
