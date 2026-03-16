import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import type { Org, OrgUser, OrgInvite, GitHubInstallation } from '../types';
import AIUsageDashboard from '../components/AIUsageDashboard';
import UserAvatar from '../components/shared/UserAvatar';
import WebhookSettings from '../components/WebhookSettings';

const ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint } }`;
const ORG_USERS_QUERY = `query { orgUsers { userId email role } }`;
const ORG_INVITES_QUERY = `query { orgInvites { inviteId email role expiresAt createdAt } }`;
const GITHUB_INSTALLATIONS_QUERY = `query { githubInstallations { installationId accountLogin accountType orgId createdAt } }`;
const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;

export default function OrgSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Team section state
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('org:member');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  // GitHub section state
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [loadingInstallations, setLoadingInstallations] = useState(true);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkingInstallation, setLinkingInstallation] = useState(false);

  useEffect(() => {
    if (user?.role !== 'org:admin') {
      navigate('/app', { replace: true });
      return;
    }
    gql<{ org: Org }>(ORG_QUERY)
      .then((data) => setOrg(data.org))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load org'));
    gql<{ orgUsers: OrgUser[] }>(ORG_USERS_QUERY)
      .then((data) => setOrgUsers(data.orgUsers))
      .catch(() => {/* non-critical */});
    gql<{ orgInvites: OrgInvite[] }>(ORG_INVITES_QUERY)
      .then((data) => setInvites(data.orgInvites))
      .catch(() => {/* non-critical */});

    // Load GitHub installations
    const loadInstallations = () => {
      setLoadingInstallations(true);
      gql<{ githubInstallations: GitHubInstallation[] }>(GITHUB_INSTALLATIONS_QUERY)
        .then((data) => setInstallations(data.githubInstallations))
        .catch(() => {/* non-critical */})
        .finally(() => setLoadingInstallations(false));
    };

    // Handle GitHub App callback — auto-link installation
    // This runs both in the main window AND in the popup window
    const params = new URLSearchParams(window.location.search);
    const callbackInstallationId = params.get('installation_id');
    if (callbackInstallationId) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);

      // If this is a popup, notify the opener and close
      if (window.opener) {
        window.opener.postMessage(
          { type: 'github-installation', installationId: callbackInstallationId },
          window.location.origin
        );
        window.close();
        return;
      }

      // Otherwise handle inline (direct navigation fallback)
      linkInstallation(callbackInstallationId, loadInstallations);
    } else {
      loadInstallations();
    }

    // Listen for messages from popup window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'github-installation') {
        linkInstallation(event.data.installationId, loadInstallations);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user, navigate]);

  const linkInstallation = (installationId: string, onDone: () => void) => {
    setLinkingInstallation(true);
    setLinkErr(null);
    gql<{ linkGitHubInstallation: GitHubInstallation }>(
      `mutation LinkInstallation($installationId: ID!) { linkGitHubInstallation(installationId: $installationId) { installationId accountLogin accountType orgId createdAt } }`,
      { installationId }
    )
      .then(() => {
        setLinkSuccess(true);
        onDone();
      })
      .catch((e) => {
        setLinkErr(e instanceof Error ? e.message : 'Failed to link installation');
        onDone();
      })
      .finally(() => setLinkingInstallation(false));
  };

  const handleInstallGitHubApp = () => {
    if (!GITHUB_APP_SLUG) return;
    const url = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(url, 'github-install', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setErr(null);
    setSuccess(false);
    try {
      const data = await gql<{ setOrgApiKey: Org }>(
        `mutation SetOrgApiKey($apiKey: String!) { setOrgApiKey(apiKey: $apiKey) { orgId name hasApiKey apiKeyHint } }`,
        { apiKey: apiKey.trim() }
      );
      setOrg(data.setOrgApiKey);
      setApiKey('');
      setSuccess(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteErr(null);
    setInviteSuccess(false);
    try {
      await gql<{ inviteOrgMember: boolean }>(
        `mutation InviteOrgMember($email: String!, $role: String) {
          inviteOrgMember(email: $email, role: $role)
        }`,
        { email: inviteEmail.trim(), role: inviteRole }
      );
      setInviteEmail('');
      setInviteSuccess(true);
      // Refresh invites list
      const data = await gql<{ orgInvites: OrgInvite[] }>(ORG_INVITES_QUERY);
      setInvites(data.orgInvites);
    } catch (error) {
      setInviteErr(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await gql<{ revokeInvite: boolean }>(
        `mutation RevokeInvite($inviteId: ID!) { revokeInvite(inviteId: $inviteId) }`,
        { inviteId }
      );
      setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    } catch (error) {
      setInviteErr(error instanceof Error ? error.message : 'Failed to revoke invite');
    }
  };

  if (!org) {
    return <div className="p-4 text-slate-500">{err ?? 'Loading…'}</div>;
  }

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>

      {/* API Key */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Organization</p>
          <p className="text-lg text-slate-800 mt-1">{org.name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-1">
            Anthropic API Key
          </p>
          {org.hasApiKey ? (
            <p className="text-slate-700 font-mono text-sm">
              {org.apiKeyHint} <span className="text-slate-400 font-sans">(configured)</span>
            </p>
          ) : (
            <p className="text-amber-600 text-sm">Not configured — AI features are disabled.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            {org.hasApiKey ? 'Replace API key' : 'Add API key'}
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-sm"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          {success && <p className="text-sm text-green-600">API key saved.</p>}
          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* Team */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">Team</h2>

        {/* Current members */}
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Members</p>
          <ul className="divide-y divide-slate-100">
            {orgUsers.map((u) => (
              <li key={u.userId} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <UserAvatar email={u.email} size="sm" />
                  <span className="text-slate-800">{u.email}</span>
                </div>
                <span className="text-slate-500">{u.role ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Pending Invites</p>
            <ul className="divide-y divide-slate-100">
              {invites.map((inv) => (
                <li key={inv.inviteId} className="py-2 flex items-center justify-between text-sm gap-2">
                  <div>
                    <span className="text-slate-800">{inv.email}</span>
                    <span className="ml-2 text-slate-500">{inv.role}</span>
                    <span className="ml-2 text-slate-400 text-xs">
                      expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevoke(inv.inviteId)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invite form */}
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Invite member</p>
          <form onSubmit={handleInvite} className="space-y-2">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            >
              <option value="org:member">Member</option>
              <option value="org:admin">Admin</option>
            </select>
            {inviteErr && <p className="text-sm text-red-600">{inviteErr}</p>}
            {inviteSuccess && <p className="text-sm text-green-600">Invite sent!</p>}
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </div>
      </div>

      {/* GitHub */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">GitHub</h2>

        {linkErr && <p className="text-sm text-red-600">{linkErr}</p>}
        {linkSuccess && <p className="text-sm text-green-600">GitHub App linked successfully!</p>}

        {loadingInstallations ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : installations.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Installations</p>
            <ul className="divide-y divide-slate-100">
              {installations.map((inst) => (
                <li key={inst.installationId} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-slate-800 font-medium">{inst.accountLogin}</span>
                    <span className="ml-2 text-slate-500">{inst.accountType}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No GitHub App installed.</p>
        )}

        {linkingInstallation && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            Linking installation…
          </div>
        )}

        {GITHUB_APP_SLUG && (
          <button
            type="button"
            onClick={handleInstallGitHubApp}
            disabled={linkingInstallation}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 text-sm"
          >
            {installations.length > 0 ? 'Add another installation' : 'Install GitHub App'}
          </button>
        )}
      </div>

      {/* Webhooks */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">Webhooks</h2>
        <WebhookSettings />
      </div>

      {/* AI Usage */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">AI Usage</h2>
        <AIUsageDashboard />
      </div>
    </div>
  );
}
