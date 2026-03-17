import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { useConfirmDialog } from './shared/ConfirmDialog';

interface SlackIntegration {
  id: string;
  teamId: string;
  teamName: string;
  channelId: string;
  channelName: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

interface SlackUserMapping {
  id: string;
  slackUserId: string;
  slackTeamId: string;
  userId: string;
  orgId: string;
  createdAt: string;
  user: { userId: string; email: string; displayName: string | null } | null;
}

interface OrgUser {
  userId: string;
  email: string;
  displayName: string | null;
}

const SUPPORTED_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'sprint.created',
  'sprint.closed',
  'comment.created',
];

const SLACK_QUERY = `query { slackIntegrations { id teamId teamName channelId channelName events enabled createdAt } }`;

export default function SlackSettings() {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [formTeamName, setFormTeamName] = useState('');
  const [formChannelId, setFormChannelId] = useState('');
  const [formChannelName, setFormChannelName] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>(['task.created', 'task.updated']);
  const [saving, setSaving] = useState(false);

  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

  // User mapping state
  const [mappings, setMappings] = useState<SlackUserMapping[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [mapSlackUserId, setMapSlackUserId] = useState('');
  const [mapTargetUserId, setMapTargetUserId] = useState('');
  const [mappingSaving, setMappingSaving] = useState(false);

  const fetchIntegrations = () => {
    setLoading(true);
    gql<{ slackIntegrations: SlackIntegration[] }>(SLACK_QUERY)
      .then((data) => setIntegrations(data.slackIntegrations))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load Slack integrations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIntegrations();
    // Fetch org users for the mapping dropdown
    gql<{ orgUsers: OrgUser[] }>(`query { orgUsers { userId email displayName } }`)
      .then((data) => setOrgUsers(data.orgUsers))
      .catch(() => { /* non-critical */ });
  }, []);

  // Auto-select single integration for user mappings
  useEffect(() => {
    if (integrations.length === 1 && !selectedIntegrationId) {
      fetchMappings(integrations[0].id);
    }
  }, [integrations, selectedIntegrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMappings = (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    gql<{ slackUserMappings: SlackUserMapping[] }>(
      `query ($integrationId: ID!) { slackUserMappings(integrationId: $integrationId) { id slackUserId slackTeamId userId orgId createdAt user { userId email displayName } } }`,
      { integrationId }
    )
      .then((data) => setMappings(data.slackUserMappings))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load mappings'));
  };

  const handleMapUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntegrationId || !mapSlackUserId.trim() || !mapTargetUserId) return;
    const integration = integrations.find((i) => i.id === selectedIntegrationId);
    if (!integration) return;
    setMappingSaving(true);
    setErr(null);
    try {
      const data = await gql<{ mapSlackUser: SlackUserMapping }>(
        `mutation MapSlack($slackUserId: String!, $slackTeamId: String!, $userId: ID!) {
          mapSlackUser(slackUserId: $slackUserId, slackTeamId: $slackTeamId, userId: $userId) {
            id slackUserId slackTeamId userId orgId createdAt user { userId email displayName }
          }
        }`,
        { slackUserId: mapSlackUserId.trim(), slackTeamId: integration.teamId, userId: mapTargetUserId }
      );
      setMappings((prev) => [data.mapSlackUser, ...prev.filter((m) => m.id !== data.mapSlackUser.id)]);
      setMapSlackUserId('');
      setMapTargetUserId('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to map user');
    } finally {
      setMappingSaving(false);
    }
  };

  const handleUnmapUser = async (mappingId: string) => {
    try {
      await gql<{ unmapSlackUser: boolean }>(
        `mutation UnmapSlack($mappingId: ID!) { unmapSlackUser(mappingId: $mappingId) }`,
        { mappingId }
      );
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to remove mapping');
    }
  };

  const handleToggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWebhookUrl.trim() || formEvents.length === 0) return;
    setSaving(true);
    setErr(null);
    try {
      const data = await gql<{ connectSlack: SlackIntegration }>(
        `mutation ConnectSlack($webhookUrl: String!, $teamId: String!, $teamName: String!, $channelId: String!, $channelName: String!, $events: [String!]!) {
          connectSlack(webhookUrl: $webhookUrl, teamId: $teamId, teamName: $teamName, channelId: $channelId, channelName: $channelName, events: $events) {
            id teamId teamName channelId channelName events enabled createdAt
          }
        }`,
        {
          webhookUrl: formWebhookUrl.trim(),
          teamId: formTeamId.trim(),
          teamName: formTeamName.trim(),
          channelId: formChannelId.trim(),
          channelName: formChannelName.trim(),
          events: formEvents,
        }
      );
      setIntegrations((prev) => [data.connectSlack, ...prev]);
      setFormWebhookUrl('');
      setFormTeamId('');
      setFormTeamName('');
      setFormChannelId('');
      setFormChannelName('');
      setFormEvents(['task.created', 'task.updated']);
      setShowForm(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to connect Slack');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (integration: SlackIntegration) => {
    try {
      await gql<{ updateSlackIntegration: SlackIntegration }>(
        `mutation UpdateSlack($id: ID!, $enabled: Boolean) {
          updateSlackIntegration(id: $id, enabled: $enabled) { id enabled }
        }`,
        { id: integration.id, enabled: !integration.enabled }
      );
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? { ...i, enabled: !i.enabled } : i))
      );
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update integration');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const data = await gql<{ testSlackIntegration: boolean }>(
        `mutation TestSlack($id: ID!) { testSlackIntegration(id: $id) }`,
        { id }
      );
      setTestResult({ id, success: data.testSlackIntegration });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Test failed');
      setTestResult({ id, success: false });
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!await confirm({ title: 'Disconnect Slack', message: 'Disconnect this Slack integration?', confirmLabel: 'Disconnect', variant: 'danger' })) return;
    try {
      await gql<{ disconnectSlack: boolean }>(
        `mutation DisconnectSlack($id: ID!) { disconnectSlack(id: $id) }`,
        { id }
      );
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to disconnect');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading Slack integrations...</p>;
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Integration list */}
      {integrations.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {integrations.map((int) => (
            <li key={int.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 font-medium">
                    {int.teamName} <span className="text-slate-400 font-normal">#{int.channelName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(int)}
                    className={`text-xs px-2 py-0.5 rounded ${
                      int.enabled
                        ? 'bg-green-50 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {int.enabled ? 'Active' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleTest(int.id)}
                    disabled={testingId === int.id}
                    className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
                  >
                    {testingId === int.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(int.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {int.events.map((ev) => (
                  <span
                    key={ev}
                    className="inline-block text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                  >
                    {ev}
                  </span>
                ))}
              </div>
              {testResult?.id === int.id && (
                <p className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? 'Test message sent successfully!' : 'Test failed — check your webhook URL.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No Slack integrations configured.</p>
      )}

      {/* User Mappings */}
      {integrations.length > 0 && (
        <div className="border border-slate-200 rounded p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">User Mappings</h3>
          <p className="text-xs text-slate-500">
            Link Slack users to TaskToad accounts for personalized slash command results.
          </p>

          {integrations.length > 1 && (
            <div>
              <label htmlFor="mapping-integration" className="block text-xs font-medium text-slate-600 mb-1">
                Integration
              </label>
              <select
                id="mapping-integration"
                value={selectedIntegrationId ?? ''}
                onChange={(e) => e.target.value && fetchMappings(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
              >
                <option value="">Select integration...</option>
                {integrations.map((int) => (
                  <option key={int.id} value={int.id}>
                    {int.teamName} — #{int.channelName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedIntegrationId && (
            <>
              {mappings.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="pb-1 font-medium">Slack User ID</th>
                      <th className="pb-1 font-medium">TaskToad User</th>
                      <th className="pb-1 font-medium sr-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mappings.map((m) => (
                      <tr key={m.id}>
                        <td className="py-1.5 text-slate-700 font-mono text-xs">{m.slackUserId}</td>
                        <td className="py-1.5 text-slate-700">{m.user?.displayName ?? m.user?.email ?? m.userId}</td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => handleUnmapUser(m.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <form onSubmit={handleMapUser} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="map-slack-user-id" className="block text-xs font-medium text-slate-600 mb-1">Slack User ID</label>
                  <input
                    id="map-slack-user-id"
                    type="text"
                    placeholder="U01234567"
                    value={mapSlackUserId}
                    onChange={(e) => setMapSlackUserId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="map-target-user" className="block text-xs font-medium text-slate-600 mb-1">TaskToad User</label>
                  <select
                    id="map-target-user"
                    value={mapTargetUserId}
                    onChange={(e) => setMapTargetUserId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    required
                  >
                    <option value="">Select user...</option>
                    {orgUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={mappingSaving || !mapSlackUserId.trim() || !mapTargetUserId}
                  className="px-3 py-1.5 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {mappingSaving ? 'Adding...' : 'Add Mapping'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Connect form */}
      {showForm ? (
        <form onSubmit={handleConnect} className="space-y-3 border border-slate-200 rounded p-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={formWebhookUrl}
              onChange={(e) => setFormWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              Create an incoming webhook in your Slack workspace settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team ID</label>
              <input
                type="text"
                placeholder="T01234567"
                value={formTeamId}
                onChange={(e) => setFormTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
              <input
                type="text"
                placeholder="My Workspace"
                value={formTeamName}
                onChange={(e) => setFormTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel ID</label>
              <input
                type="text"
                placeholder="C01234567"
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel Name</label>
              <input
                type="text"
                placeholder="general"
                value={formChannelName}
                onChange={(e) => setFormChannelName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Events</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(event)}
                    onChange={() => handleToggleEvent(event)}
                    className="rounded border-slate-300"
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !formWebhookUrl.trim() || formEvents.length === 0}
              className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
            >
              {saving ? 'Connecting...' : 'Connect Slack'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover text-sm"
        >
          Connect Slack
        </button>
      )}
      <ConfirmDialogPortal />
    </div>
  );
}
