import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import type { GitHubInstallation, GitHubRepoLink, GitHubRepo } from '../types';
import Modal from './shared/Modal';

interface GitHubRepoModalProps {
  projectId: string;
  installations: GitHubInstallation[];
  currentRepo: GitHubRepoLink | null;
  onConnected: (repo: GitHubRepoLink) => void;
  onDisconnected: () => void;
  onClose: () => void;
}

export default function GitHubRepoModal({
  projectId,
  installations,
  currentRepo,
  onConnected,
  onDisconnected,
  onClose,
}: GitHubRepoModalProps) {
  const [selectedInstallation, setSelectedInstallation] = useState('');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedInstallation) {
      setRepos([]);
      return;
    }
    setLoadingRepos(true);
    setErr(null);
    setSelectedRepo('');
    gql<{ githubInstallationRepos: GitHubRepo[] }>(
      `query GitHubRepos($installationId: ID!) { githubInstallationRepos(installationId: $installationId) { id name owner fullName isPrivate defaultBranch } }`,
      { installationId: selectedInstallation }
    )
      .then((data) => setRepos(data.githubInstallationRepos))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load repos'))
      .finally(() => setLoadingRepos(false));
  }, [selectedInstallation]);

  const filteredRepos = repos.filter((r) =>
    r.fullName.toLowerCase().includes(repoFilter.toLowerCase())
  );

  const handleConnect = async () => {
    const repo = repos.find((r) => r.fullName === selectedRepo);
    if (!repo) return;
    setConnecting(true);
    setErr(null);
    try {
      const data = await gql<{ connectGitHubRepo: GitHubRepoLink }>(
        `mutation ConnectRepo($projectId: ID!, $installationId: ID!, $owner: String!, $name: String!) {
          connectGitHubRepo(projectId: $projectId, installationId: $installationId, owner: $owner, name: $name) {
            repositoryId repositoryName repositoryOwner installationId defaultBranch
          }
        }`,
        { projectId, installationId: selectedInstallation, owner: repo.owner, name: repo.name }
      );
      onConnected(data.connectGitHubRepo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to connect repo');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setErr(null);
    try {
      await gql<{ disconnectGitHubRepo: boolean }>(
        `mutation DisconnectRepo($projectId: ID!) { disconnectGitHubRepo(projectId: $projectId) }`,
        { projectId }
      );
      onDisconnected();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to disconnect repo');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="GitHub Repository" size="sm">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">GitHub Repository</h2>

        {currentRepo ? (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Connected</p>
              <p className="text-slate-800 dark:text-slate-200 font-mono text-sm">
                {currentRepo.repositoryOwner}/{currentRepo.repositoryName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Default branch: <span className="font-mono">{currentRepo.defaultBranch}</span>
              </p>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-between">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {installations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No GitHub App installations found. Install the GitHub App from your organization settings first.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Installation</label>
                  <select
                    value={selectedInstallation}
                    onChange={(e) => setSelectedInstallation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded text-sm"
                  >
                    <option value="">Select installation…</option>
                    {installations.map((inst) => (
                      <option key={inst.installationId} value={inst.installationId}>
                        {inst.accountLogin} ({inst.accountType})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInstallation && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repository</label>
                    {loadingRepos ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Loading repositories…</p>
                    ) : (
                      <>
                        {repos.length > 5 && (
                          <input
                            type="text"
                            placeholder="Filter repos…"
                            value={repoFilter}
                            onChange={(e) => setRepoFilter(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded text-sm mb-2"
                          />
                        )}
                        <select
                          value={selectedRepo}
                          onChange={(e) => setSelectedRepo(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded text-sm"
                          size={Math.min(filteredRepos.length + 1, 8)}
                        >
                          <option value="">Select repository…</option>
                          {filteredRepos.map((r) => (
                            <option key={r.id} value={r.fullName}>
                              {r.fullName} {r.isPrivate ? '(private)' : ''}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              {installations.length > 0 && (
                <button
                  onClick={handleConnect}
                  disabled={connecting || !selectedRepo}
                  className="px-4 py-1.5 text-sm bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? 'Connecting…' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
