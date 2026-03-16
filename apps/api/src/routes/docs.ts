import { Router, type Router as RouterType } from 'express';
import { printSchema, introspectionFromSchema } from 'graphql';
import { schema } from '../graphql/schema.js';

export const docsRouter: RouterType = Router();

// ── Domain groupings for operations ──

const domainKeywords: Record<string, string[]> = {
  Auth: ['signup', 'login', 'me', 'sendVerification', 'verifyEmail', 'requestPasswordReset', 'resetPassword', 'updateProfile', 'inviteOrgMember', 'acceptInvite', 'revokeInvite', 'orgInvites'],
  Organization: ['org', 'createOrg', 'setOrgApiKey', 'setAIBudget', 'orgUsers'],
  Project: ['project', 'createProject', 'updateProject', 'archiveProject', 'generateProjectOptions', 'createProjectFromOption', 'projectStats', 'portfolioOverview', 'savedFilters', 'saveFilter', 'updateFilter', 'deleteFilter'],
  Task: ['tasks', 'createTask', 'updateTask', 'createSubtask', 'bulkUpdateTasks', 'createLabel', 'deleteLabel', 'addTaskLabel', 'removeTaskLabel', 'labels', 'epics', 'customField', 'setCustomFieldValue', 'addTaskAssignee', 'removeTaskAssignee', 'expandTask'],
  Sprint: ['sprint', 'createSprint', 'updateSprint', 'deleteSprint', 'closeSprint', 'sprintVelocity', 'sprintBurndown', 'previewSprintPlan', 'commitSprintPlan'],
  Comment: ['comment', 'createComment', 'updateComment', 'deleteComment', 'activities'],
  AI: ['ai', 'generateTaskPlan', 'previewTaskPlan', 'commitTaskPlan', 'generateTaskInstructions', 'generateCodeFromTask', 'generateCodeFromSubtask', 'regenerateCodeFile', 'reviewPullRequest', 'parseBugReport', 'previewPRDBreakdown', 'commitPRDBreakdown', 'bootstrapProjectFromRepo', 'batchGenerateCode', 'analyzeTrends', 'analyzeSprintTransition', 'projectChat', 'analyzeRepoDrift', 'summarizeProject'],
  Search: ['globalSearch'],
  Notification: ['notification', 'markNotificationRead', 'markAllNotificationsRead', 'updateNotificationPreference', 'unreadNotificationCount', 'notificationPreferences'],
  GitHub: ['github', 'linkGitHubInstallation', 'connectGitHubRepo', 'disconnectGitHubRepo', 'createGitHubRepo', 'createPullRequestFromTask', 'syncTaskToGitHub', 'decomposeGitHubIssue', 'generateFixFromReview', 'fetchRepoFileContent'],
  Report: ['report', 'generateStandupReport', 'generateSprintReport', 'analyzeProjectHealth', 'extractTasksFromNotes', 'saveReport', 'deleteReport'],
  ProjectRole: ['projectMembers', 'addProjectMember', 'removeProjectMember', 'updateProjectMemberRole', 'automationRule'],
  Webhook: ['webhook', 'createWebhookEndpoint', 'updateWebhookEndpoint', 'deleteWebhookEndpoint', 'testWebhookEndpoint', 'replayWebhookDelivery'],
  Slack: ['slack', 'connectSlack', 'updateSlackIntegration', 'disconnectSlack', 'testSlackIntegration', 'mapSlackUser', 'unmapSlackUser'],
};

interface ParsedOperation {
  name: string;
  signature: string;
  description?: string;
}

function parseOperations(block: string): ParsedOperation[] {
  const ops: ParsedOperation[] = [];
  const lines = block.split('\n');
  let pendingDescription: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for triple-quote description (single-line form: """...""")
    const descMatch = trimmed.match(/^"""(.+)"""$/);
    if (descMatch) {
      pendingDescription = descMatch[1].trim();
      continue;
    }

    // Skip multi-line triple-quote delimiters
    if (trimmed === '"""') {
      continue;
    }

    const nameMatch = trimmed.match(/^(\w+)/);
    ops.push({
      name: nameMatch?.[1] ?? trimmed,
      signature: trimmed,
      description: pendingDescription,
    });
    pendingDescription = undefined;
  }

  return ops;
}

function classifyOperation(op: ParsedOperation): string {
  const name = op.name.toLowerCase();
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    for (const kw of keywords) {
      if (name === kw.toLowerCase() || name.startsWith(kw.toLowerCase())) {
        return domain;
      }
    }
  }
  return 'Other';
}

function groupByDomain(ops: ParsedOperation[]): Record<string, ParsedOperation[]> {
  const grouped: Record<string, ParsedOperation[]> = {};
  for (const op of ops) {
    const domain = classifyOperation(op);
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(op);
  }
  return grouped;
}

function renderDomainSections(grouped: Record<string, ParsedOperation[]>, kind: string): string {
  const domainOrder = Object.keys(domainKeywords);
  const allDomains = [...new Set([...domainOrder, ...Object.keys(grouped)])];

  return allDomains
    .filter((d) => grouped[d]?.length)
    .map((domain) => {
      const ops = grouped[domain]!;
      const opsHtml = ops
        .map((op) => {
          const descHtml = op.description
            ? `<p class="op-desc">${escapeHtml(op.description)}</p>`
            : '';
          return `<div class="op-entry"><code>${escapeHtml(op.signature)}</code>${descHtml}</div>`;
        })
        .join('\n');
      return `<div class="domain-group" id="${kind.toLowerCase()}-${domain.toLowerCase()}">
        <h3>${domain} <span class="count">(${ops.length})</span></h3>
        ${opsHtml}
      </div>`;
    })
    .join('\n');
}

function buildSidebarLinks(queryDomains: string[], mutationDomains: string[]): string {
  const qLinks = queryDomains
    .map((d) => `<a href="#queries-${d.toLowerCase()}">${d}</a>`)
    .join('');
  const mLinks = mutationDomains
    .map((d) => `<a href="#mutations-${d.toLowerCase()}">${d}</a>`)
    .join('');

  return `
    <div class="nav-group"><strong>Quick Links</strong>
      <a href="#authentication">Authentication</a>
      <a href="#rate-limits">Rate Limits</a>
      <a href="#quick-start">Quick Start</a>
    </div>
    <div class="nav-group"><strong>Queries</strong>${qLinks}</div>
    <div class="nav-group"><strong>Mutations</strong>${mLinks}</div>
    <div class="nav-group"><strong>Reference</strong>
      <a href="#types">Types</a>
      <a href="#schema-download">Schema Downloads</a>
    </div>`;
}

// ── Routes ──

docsRouter.get('/', (_req, res) => {
  const sdl = printSchema(schema);

  const queryMatch = sdl.match(/type Query \{([\s\S]*?)\}/);
  const mutationMatch = sdl.match(/type Mutation \{([\s\S]*?)\}/);

  const queries = parseOperations(queryMatch?.[1]?.trim() ?? '');
  const mutations = parseOperations(mutationMatch?.[1]?.trim() ?? '');

  const queryGroups = groupByDomain(queries);
  const mutationGroups = groupByDomain(mutations);

  const queryDomains = Object.keys(queryGroups);
  const mutationDomains = Object.keys(mutationGroups);

  // Types section — remove Query/Mutation blocks
  const types = sdl
    .replace(/type Query \{[\s\S]*?\}/, '')
    .replace(/type Mutation \{[\s\S]*?\}/, '')
    .trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskToad API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #333; line-height: 1.6; }
    .layout { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar { width: 240px; background: #1a2332; color: #c8d6e5; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; padding: 1.5rem 1rem; font-size: 0.85rem; }
    .sidebar h2 { color: #4CAF50; font-size: 1.1rem; margin-bottom: 1rem; }
    .sidebar .nav-group { margin-bottom: 1rem; }
    .sidebar .nav-group strong { display: block; color: #8899aa; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
    .sidebar a { display: block; color: #c8d6e5; text-decoration: none; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .sidebar a:hover { background: #2a3a4e; color: #fff; }

    /* Main content */
    .main { margin-left: 240px; flex: 1; padding: 2rem 3rem; max-width: 900px; }
    h1 { color: #1a2332; margin-bottom: 0.25rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .subtitle a { color: #4CAF50; }
    h2 { margin-top: 2.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e0e0e0; color: #1a2332; }
    h3 { margin-top: 1.2rem; margin-bottom: 0.5rem; color: #2a3a4e; }
    .count { color: #999; font-weight: normal; font-size: 0.85em; }

    /* Sections */
    .section { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    pre { background: #1a2332; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.82rem; margin: 0.75rem 0; }
    code { font-family: 'Fira Code', 'Consolas', 'Monaco', monospace; }
    p code { background: #eef2f7; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }

    /* Operations */
    .domain-group { margin-bottom: 1rem; }
    .op-entry { padding: 0.35rem 0; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
    .op-entry:last-child { border-bottom: none; }
    .op-entry code { color: #1a2332; background: none; }
    .op-desc { color: #666; font-size: 0.8rem; margin-top: 0.15rem; }

    /* Rate limits table */
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; }

    .note { background: #e8f5e9; border-left: 4px solid #4CAF50; border-radius: 4px; padding: 0.75rem 1rem; margin: 0.75rem 0; font-size: 0.9rem; }
    .warning { background: #fff3e0; border-left: 4px solid #ff9800; }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 1rem; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <h2>TaskToad API</h2>
      ${buildSidebarLinks(queryDomains, mutationDomains)}
    </nav>

    <main class="main">
      <h1>TaskToad API Documentation</h1>
      <p class="subtitle">GraphQL API &mdash; <a href="/graphql">Open GraphiQL Playground</a> | <a href="/api/docs/schema.graphql">SDL</a> | <a href="/api/docs/schema.json">Introspection JSON</a></p>

      <!-- Authentication -->
      <div class="section" id="authentication">
        <h2>Authentication</h2>
        <p>All operations require an <code>Authorization: Bearer &lt;token&gt;</code> header, except <code>signup</code> and <code>login</code>.</p>

        <h3>Getting a Token</h3>
        <p>Call the <code>login</code> mutation with your email and password. The returned token is a JWT (HS256) valid for <strong>7 days</strong>.</p>

        <h3>curl &mdash; Login</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "mutation { login(email: \\"user@example.com\\", password: \\"secret\\") { token user { userId email } } }"}'</code></pre>

        <h3>curl &mdash; Authenticated Request</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"query": "{ me { userId email orgId } }"}'</code></pre>
      </div>

      <!-- Rate Limits -->
      <div class="section" id="rate-limits">
        <h2>Rate Limits</h2>
        <p>The API enforces rate limits per IP address. Exceeding a limit returns HTTP 429.</p>
        <table>
          <thead><tr><th>Scope</th><th>Limit</th><th>Window</th></tr></thead>
          <tbody>
            <tr><td>Global (all endpoints)</td><td>200 requests</td><td>1 minute</td></tr>
            <tr><td>Auth (<code>signup</code>, <code>login</code>)</td><td>10 requests</td><td>1 minute</td></tr>
            <tr><td>Password reset</td><td>5 requests</td><td>1 minute</td></tr>
            <tr><td>Export (<code>/api/export/*</code>)</td><td>5 requests</td><td>10 minutes</td></tr>
            <tr><td>SSE connections</td><td>5 concurrent</td><td>&mdash;</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Quick Start -->
      <div class="section" id="quick-start">
        <h2>Quick Start</h2>
        <div class="note">Replace <code>YOUR_TOKEN</code> with the token from the login response.</div>

        <h3>1. Sign up &amp; Login</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "mutation { signup(email: \\"you@example.com\\", password: \\"MyP@ssw0rd\\") { token } }"}'</code></pre>

        <h3>2. Create an Organization</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"query": "mutation { createOrg(name: \\"My Team\\") { orgId name } }"}'</code></pre>

        <h3>3. Create a Project</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"query": "mutation { createProject(name: \\"My Project\\") { projectId name } }"}'</code></pre>

        <h3>4. Create a Task</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"query": "mutation { createTask(projectId: \\"PROJECT_ID\\", title: \\"First task\\") { taskId title status } }"}'</code></pre>

        <h3>5. List Tasks</h3>
        <pre><code>curl -X POST http://localhost:3001/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"query": "{ tasks(projectId: \\"PROJECT_ID\\") { tasks { taskId title status priority } hasMore total } }"}'</code></pre>
      </div>

      <!-- Queries -->
      <div class="section" id="queries">
        <h2>Queries</h2>
        ${renderDomainSections(queryGroups, 'queries')}
      </div>

      <!-- Mutations -->
      <div class="section" id="mutations">
        <h2>Mutations</h2>
        ${renderDomainSections(mutationGroups, 'mutations')}
      </div>

      <!-- Types -->
      <div class="section" id="types">
        <h2>Types</h2>
        <pre><code>${escapeHtml(types)}</code></pre>
      </div>

      <!-- Schema Downloads -->
      <div class="section" id="schema-download">
        <h2>Schema Downloads</h2>
        <p>Download the schema for use with external tools (Postman, Insomnia, graphql-codegen, etc.):</p>
        <ul style="margin: 0.75rem 0; padding-left: 1.5rem;">
          <li><a href="/api/docs/schema.graphql">schema.graphql</a> &mdash; Raw SDL text</li>
          <li><a href="/api/docs/schema.json">schema.json</a> &mdash; Introspection JSON</li>
        </ul>
      </div>
    </main>
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

// ── Schema download endpoints ──

docsRouter.get('/schema.graphql', (_req, res) => {
  const sdl = printSchema(schema);
  res.type('text/plain').send(sdl);
});

docsRouter.get('/schema.json', (_req, res) => {
  const introspection = introspectionFromSchema(schema);
  res.json(introspection);
});

// ── Helpers ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
