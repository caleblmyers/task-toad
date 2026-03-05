const BASE = (import.meta.env.VITE_API_URL as string) ?? '';

function getToken(): string | null {
  // MVP: stored in localStorage. For production consider httpOnly cookies or in-memory only.
  return localStorage.getItem('task-toad-id-token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  let data: T | undefined;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      return { error: text || res.statusText, status: res.status };
    }
  }
  if (!res.ok) {
    const err = data && typeof data === 'object' && 'error' in data ? (data as { error: string }).error : text;
    return { error: err || res.statusText, status: res.status };
  }
  return { data: data as T, status: res.status };
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
