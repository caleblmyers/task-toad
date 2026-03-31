import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Lightweight page that the GitHub OAuth popup redirects to after success.
 * Posts a message to the opener window and closes itself.
 * Falls back to a storage event if window.opener was stripped by the browser.
 */
export default function GitHubCallback() {
  const [params] = useSearchParams();
  const login = params.get('login');

  useEffect(() => {
    if (!login) return;

    if (window.opener) {
      window.opener.postMessage(
        { type: 'github-oauth-success', login },
        window.location.origin,
      );
      window.close();
      return;
    }

    // Fallback: use localStorage event to notify the opener tab.
    // The opener listens for 'storage' events on this key.
    localStorage.setItem('github-oauth-result', JSON.stringify({ login, ts: Date.now() }));
    window.close();
  }, [login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <p className="text-slate-600 dark:text-slate-400">
        GitHub account connected! This window should close automatically.
      </p>
    </div>
  );
}
