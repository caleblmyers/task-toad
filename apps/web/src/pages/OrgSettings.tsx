import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import { useFormState } from '../hooks/useFormState';
import type { Org, OrgUser, OrgInvite, GitHubInstallation } from '../types';
import AIUsageDashboard from '../components/AIUsageDashboard';
import UserAvatar from '../components/shared/UserAvatar';
import WebhookSettings from '../components/WebhookSettings';
import SlackSettings from '../components/SlackSettings';
import Tabs from '../components/shared/Tabs';
import Card from '../components/shared/Card';
import SectionHeader from '../components/shared/SectionHeader';
import Input from '../components/shared/Input';
import Select from '../components/shared/Select';

const ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint promptLoggingEnabled } }`;
const ORG_USERS_QUERY = `query { orgUsers { userId email role } }`;
const ORG_INVITES_QUERY = `query { orgInvites { inviteId email role expiresAt createdAt } }`;
const GITHUB_INSTALLATIONS_QUERY = `query { githubInstallations { installationId accountLogin accountType orgId createdAt } }`;
const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;

export default function OrgSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // API Key form
  const apiKeyForm = useFormState(
    { apiKey: '' as string },
    async (values) => {
      if (!values.apiKey.trim()) return;
      const data = await gql<{ setOrgApiKey: Org }>(
        `mutation SetOrgApiKey($apiKey: String!) { setOrgApiKey(apiKey: $apiKey) { orgId name hasApiKey apiKeyHint } }`,
        { apiKey: values.apiKey.trim() }
      );
      setOrg(data.setOrgApiKey);
    },
    { resetOnSuccess: true }
  );

  // Team section state
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const reloadInvites = async () => {
    const data = await gql<{ orgInvites: OrgInvite[] }>(ORG_INVITES_QUERY);
    setInvites(data.orgInvites);
  };

  // Team invite form
  const inviteForm = useFormState(
    { email: '' as string, role: 'org:member' as string },
    async (values) => {
      if (!values.email.trim()) return;
      await gql<{ inviteOrgMember: boolean }>(
        `mutation InviteOrgMember($email: String!, $role: String) {
          inviteOrgMember(email: $email, role: $role)
        }`,
        { email: values.email.trim(), role: values.role }
      );
      await reloadInvites();
    },
    { resetOnSuccess: true }
  );

  // GitHub section state
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [loadingInstallations, setLoadingInstallations] = useState(true);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkingInstallation, setLinkingInstallation] = useState(false);

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

  useEffect(() => {
    if (user?.role !== 'org:admin') {
      navigate('/app', { replace: true });
      return;
    }
    gql<{ org: Org }>(ORG_QUERY)
      .then((data) => setOrg(data.org))
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Failed to load org'));
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
  }, [user, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInstallGitHubApp = () => {
    if (!GITHUB_APP_SLUG) return;
    const url = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(url, 'github-install', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await gql<{ revokeInvite: boolean }>(
        `mutation RevokeInvite($inviteId: ID!) { revokeInvite(inviteId: $inviteId) }`,
        { inviteId }
      );
      setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    } catch (error) {
      inviteForm.setError(error instanceof Error ? error.message : 'Failed to revoke invite');
    }
  };

  if (!org) {
    return <div className="p-4 text-slate-500">{loadErr ?? 'Loading…'}</div>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-6">Settings</h1>

      <Tabs
        tabs={[
          {
            id: 'general',
            label: 'General',
            content: (
              <Card className="space-y-6">
                <div>
                  <SectionHeader>Organization</SectionHeader>
                  <p className="text-lg text-slate-800 dark:text-slate-200 mt-1">{org.name}</p>
                </div>

                <div>
                  <SectionHeader>Anthropic API Key</SectionHeader>
                  {org.hasApiKey ? (
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                      {org.apiKeyHint} <span className="text-slate-400 font-sans">(configured)</span>
                    </p>
                  ) : (
                    <p className="text-amber-600 text-sm">Not configured — AI features are disabled.</p>
                  )}
                </div>

                <form onSubmit={apiKeyForm.handleSubmit} className="space-y-3">
                  <Input
                    label={org.hasApiKey ? 'Replace API key' : 'Add API key'}
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeyForm.values.apiKey}
                    onChange={(e) => apiKeyForm.setValue('apiKey', e.target.value)}
                    error={apiKeyForm.error ?? undefined}
                    className="font-mono"
                  />
                  {apiKeyForm.success && <p className="text-sm text-green-600">API key saved.</p>}
                  <button
                    type="submit"
                    disabled={apiKeyForm.loading || !apiKeyForm.values.apiKey.trim()}
                    className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {apiKeyForm.loading ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </Card>
            ),
          },
          {
            id: 'team',
            label: 'Team',
            content: (
              <Card className="space-y-6">
                {/* Current members */}
                <div>
                  <SectionHeader>Members</SectionHeader>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orgUsers.map((u) => (
                      <li key={u.userId} className="py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <UserAvatar email={u.email} size="sm" />
                          <span className="text-slate-800 dark:text-slate-200">{u.email}</span>
                        </div>
                        <span className="text-slate-500">{u.role ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pending invites */}
                {invites.length > 0 && (
                  <div>
                    <SectionHeader>Pending Invites</SectionHeader>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invites.map((inv) => (
                        <li key={inv.inviteId} className="py-2 flex items-center justify-between text-sm gap-2">
                          <div>
                            <span className="text-slate-800 dark:text-slate-200">{inv.email}</span>
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
                  <SectionHeader>Invite member</SectionHeader>
                  <form onSubmit={inviteForm.handleSubmit} className="space-y-2">
                    <Input
                      label="Email address"
                      type="email"
                      value={inviteForm.values.email}
                      onChange={(e) => inviteForm.setValue('email', e.target.value)}
                      required
                    />
                    <Select
                      label="Role"
                      value={inviteForm.values.role}
                      onChange={(e) => inviteForm.setValue('role', e.target.value)}
                    >
                      <option value="org:member">Member</option>
                      <option value="org:admin">Admin</option>
                    </Select>
                    {inviteForm.error && <p className="text-sm text-red-600" aria-live="polite">{inviteForm.error}</p>}
                    {inviteForm.success && <p className="text-sm text-green-600" aria-live="polite">Invite sent!</p>}
                    <button
                      type="submit"
                      disabled={inviteForm.loading || !inviteForm.values.email.trim()}
                      className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {inviteForm.loading ? 'Sending…' : 'Send invite'}
                    </button>
                  </form>
                </div>
              </Card>
            ),
          },
          {
            id: 'integrations',
            label: 'Integrations',
            content: (
              <div className="space-y-6">
                {/* GitHub */}
                <Card className="space-y-6">
                  <SectionHeader>GitHub</SectionHeader>

                  {linkErr && <p className="text-sm text-red-600">{linkErr}</p>}
                  {linkSuccess && <p className="text-sm text-green-600">GitHub App linked successfully!</p>}

                  {loadingInstallations ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                  ) : installations.length > 0 ? (
                    <div>
                      <SectionHeader>Installations</SectionHeader>
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {installations.map((inst) => (
                          <li key={inst.installationId} className="py-2 flex items-center justify-between text-sm">
                            <div>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{inst.accountLogin}</span>
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
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
                      Linking installation…
                    </div>
                  )}

                  {GITHUB_APP_SLUG && (
                    <button
                      type="button"
                      onClick={handleInstallGitHubApp}
                      disabled={linkingInstallation}
                      className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
                    >
                      {installations.length > 0 ? 'Add another installation' : 'Install GitHub App'}
                    </button>
                  )}
                </Card>

                {/* Slack */}
                <Card className="space-y-6">
                  <SectionHeader>Slack</SectionHeader>
                  <SlackSettings />
                </Card>
              </div>
            ),
          },
          {
            id: 'webhooks',
            label: 'Webhooks',
            content: (
              <Card className="space-y-6">
                <WebhookSettings />
              </Card>
            ),
          },
          {
            id: 'ai',
            label: 'AI',
            content: (
              <div className="space-y-6">
                <Card className="space-y-6">
                  <SectionHeader>AI Settings</SectionHeader>

                  {/* Prompt Logging Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Prompt Logging</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        When enabled, AI prompts and responses are stored for auditing and debugging.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={org.promptLoggingEnabled !== false}
                      onClick={async () => {
                        const newValue = org.promptLoggingEnabled === false;
                        setOrg({ ...org, promptLoggingEnabled: newValue });
                        try {
                          await gql<{ setAIBudget: Org }>(
                            `mutation SetAIBudget($promptLoggingEnabled: Boolean) { setAIBudget(promptLoggingEnabled: $promptLoggingEnabled) { orgId name hasApiKey apiKeyHint promptLoggingEnabled } }`,
                            { promptLoggingEnabled: newValue }
                          );
                        } catch (error) {
                          setOrg({ ...org, promptLoggingEnabled: !newValue });
                          setLoadErr(error instanceof Error ? error.message : 'Failed to update prompt logging');
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 ${
                        org.promptLoggingEnabled !== false ? 'bg-brand-green' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          org.promptLoggingEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </Card>

                <Card className="space-y-6">
                  <SectionHeader>AI Usage</SectionHeader>
                  <AIUsageDashboard />
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
