import { Router, type Router as RouterType } from 'express';
import { printSchema } from 'graphql';
import { schema } from '../graphql/schema.js';

export const docsRouter: RouterType = Router();

docsRouter.get('/', (_req, res) => {
  const sdl = printSchema(schema);

  // Extract queries and mutations from the SDL
  const queryMatch = sdl.match(/type Query \{([\s\S]*?)\}/);
  const mutationMatch = sdl.match(/type Mutation \{([\s\S]*?)\}/);

  const queries = queryMatch?.[1]?.trim() ?? '';
  const mutations = mutationMatch?.[1]?.trim() ?? '';

  // Remove Query and Mutation blocks from types
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    h2 { margin-top: 2rem; margin-bottom: 1rem; border-bottom: 2px solid #ddd; padding-bottom: 0.5rem; }
    h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; margin-bottom: 1rem; }
    code { font-family: 'Fira Code', 'Consolas', monospace; }
    .note { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .section { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    a { color: #0066cc; }
    .subtitle { color: #666; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TaskToad API Documentation</h1>
    <p class="subtitle">GraphQL API &mdash; <a href="/graphql">Open GraphiQL Playground</a></p>

    <div class="section">
      <h2>Authentication</h2>
      <p>All operations require an <code>Authorization: Bearer &lt;token&gt;</code> header, except <code>signup</code> and <code>login</code>.</p>
      <h3>Example: Login</h3>
      <pre><code>fetch('/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: \`mutation { login(email: "user@example.com", password: "secret") { token } }\`
  })
})
.then(r => r.json())
.then(data => console.log(data.data.login.token));</code></pre>

      <h3>Example: Authenticated Request</h3>
      <pre><code>fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ query: '{ me { userId email } }' })
})
.then(r => r.json())
.then(data => console.log(data));</code></pre>
    </div>

    <div class="section">
      <h2>Queries</h2>
      <pre><code>${escapeHtml(queries)}</code></pre>
    </div>

    <div class="section">
      <h2>Mutations</h2>
      <pre><code>${escapeHtml(mutations)}</code></pre>
    </div>

    <div class="section">
      <h2>Types</h2>
      <pre><code>${escapeHtml(types)}</code></pre>
    </div>

    <div class="section">
      <h2>Full Schema (SDL)</h2>
      <pre><code>${escapeHtml(sdl)}</code></pre>
    </div>
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
