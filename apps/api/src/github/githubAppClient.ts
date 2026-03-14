/**
 * Reusable GraphQL client for the GitHub API.
 *
 * Handles authentication, rate-limit backoff, and transient error retries.
 */

import { logApiError } from './githubLogger.js';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; type?: string }>;
}

/**
 * Execute a GraphQL request against the GitHub API.
 *
 * Retries on transient errors (5xx, network failures) and respects
 * rate-limit headers with automatic backoff.
 */
export async function githubRequest<T>(
  installationToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${installationToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ query, variables }),
      });

      // Handle rate limiting
      if (response.status === 403 || response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const resetHeader = response.headers.get('x-ratelimit-reset');
        let waitMs = RETRY_DELAY_MS * attempt;

        if (retryAfter) {
          waitMs = parseInt(retryAfter, 10) * 1000;
        } else if (resetHeader) {
          const resetTime = parseInt(resetHeader, 10) * 1000;
          waitMs = Math.max(resetTime - Date.now(), 1000);
        }

        logApiError('rate_limited', new Error(`Rate limited on attempt ${attempt}`), {
          status: response.status,
          waitMs,
        });

        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        throw new Error(`GitHub API rate limited after ${MAX_RETRIES} attempts`);
      }

      // Retry on server errors
      if (response.status >= 500) {
        lastError = new Error(`GitHub API returned ${response.status}`);
        logApiError('server_error', lastError, { status: response.status, attempt });
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${body}`);
      }

      const json = (await response.json()) as GraphQLResponse<T>;

      if (json.errors?.length) {
        const messages = json.errors.map((e) => e.message).join('; ');
        throw new Error(`GitHub GraphQL errors: ${messages}`);
      }

      if (!json.data) {
        throw new Error('GitHub GraphQL response missing data');
      }

      return json.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network / transient errors
      const isTransient =
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');

      if (isTransient && attempt < MAX_RETRIES) {
        logApiError('transient_error', lastError, { attempt });
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error('GitHub request failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
