import { type Page } from '@playwright/test';

const API_URL = 'http://localhost:3001';

/** Generate a unique email for test isolation */
export function testEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/** Signup a new user via the API and return credentials */
export async function signupUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation Signup($email: String!, $password: String!) {
        signup(email: $email, password: $password) { token user { userId email } }
      }`,
      variables: { email, password },
    }),
  });
  const json = (await res.json()) as {
    data?: {
      signup: { token: string; user: { userId: string; email: string } };
    };
    errors?: unknown[];
  };
  if (json.errors)
    throw new Error(`Signup failed: ${JSON.stringify(json.errors)}`);
  return json.data!.signup;
}

/** Set auth token in localStorage so the app treats the user as logged in */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((t) => {
    localStorage.setItem('task-toad-id-token', t);
  }, token);
}

/** Verify a user's email directly via the API (bypassing email sending) */
export async function verifyEmailDirect(token: string) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `mutation { sendVerificationEmail }`,
    }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: unknown[] };
  if (json.errors)
    throw new Error(
      `Send verification failed: ${JSON.stringify(json.errors)}`
    );
}

/** Create an organization via the API */
export async function createOrg(token: string, name: string) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `mutation CreateOrg($name: String!) {
        createOrg(name: $name) { orgId name }
      }`,
      variables: { name },
    }),
  });
  const json = (await res.json()) as {
    data?: { createOrg: { orgId: string; name: string } };
    errors?: unknown[];
  };
  if (json.errors)
    throw new Error(`createOrg failed: ${JSON.stringify(json.errors)}`);
  return json.data!.createOrg;
}

/** Create a project via the API */
export async function createProject(token: string, name: string) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `mutation CreateProject($name: String!) {
        createProject(name: $name) { projectId name }
      }`,
      variables: { name },
    }),
  });
  const json = (await res.json()) as {
    data?: { createProject: { projectId: string; name: string } };
    errors?: unknown[];
  };
  if (json.errors)
    throw new Error(`createProject failed: ${JSON.stringify(json.errors)}`);
  return json.data!.createProject;
}

/** Create a task via the API */
export async function createTask(
  token: string,
  projectId: string,
  title: string
) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `mutation CreateTask($projectId: ID!, $title: String!) {
        createTask(projectId: $projectId, title: $title) { taskId title status projectId }
      }`,
      variables: { projectId, title },
    }),
  });
  const json = (await res.json()) as {
    data?: {
      createTask: {
        taskId: string;
        title: string;
        status: string;
        projectId: string;
      };
    };
    errors?: unknown[];
  };
  if (json.errors)
    throw new Error(`createTask failed: ${JSON.stringify(json.errors)}`);
  return json.data!.createTask;
}

/** Execute a raw GraphQL query/mutation against the API */
export async function graphqlRequest<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors)
    throw new Error(`GraphQL request failed: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}
