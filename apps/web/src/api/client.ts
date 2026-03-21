const BASE = (import.meta.env.VITE_API_URL as string) ?? '/api';

/** @deprecated No longer used for auth — cookies handle authentication now. */
export const TOKEN_KEY = 'task-toad-id-token';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/** Attempt to refresh the access token using the refresh cookie. */
async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  }).then((res) => {
    isRefreshing = false;
    refreshPromise = null;
    return res.ok;
  }).catch(() => {
    isRefreshing = false;
    refreshPromise = null;
    return false;
  });
  return refreshPromise;
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
    signal,
  });

  // On 401, try refreshing the access token and retry once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryRes = await fetch(`${BASE}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ query, variables }),
        signal,
      });
      if (!retryRes.ok) {
        const text = await retryRes.text().catch(() => '');
        throw new Error(`Server error (${retryRes.status}): ${text.slice(0, 200)}`);
      }
      const json = await retryRes.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      return json.data as T;
    }
    // Refresh failed — notify UI instead of hard redirect
    window.dispatchEvent(new CustomEvent('session-expired'));
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}
