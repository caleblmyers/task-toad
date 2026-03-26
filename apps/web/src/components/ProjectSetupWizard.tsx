import { useState, useEffect, useCallback } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import { gql } from '../api/client';
import {
  GITHUB_INSTALLATIONS_QUERY,
  SCAFFOLD_PROJECT_MUTATION,
  CREATE_GITHUB_REPO_MUTATION,
  ME_QUERY,
  RECOMMEND_STACK_QUERY,
  BOOTSTRAP_REPO_MUTATION,
} from '../api/queries';
import type { GitHubInstallation, GitHubRepoLink, MeResponse } from '../types';

interface ProjectSetupWizardProps {
  isOpen: boolean;
  projectId: string;
  onComplete: () => void;
  onSkip: () => void;
}

type WizardStep = 'github' | 'recommend' | 'scaffolding' | 'analyze' | 'done';

interface ScaffoldResult {
  success: boolean;
  filesCreated: number;
  summary: string;
  commitUrl: string | null;
}

interface StackConfig {
  framework: string;
  language: string;
  packages: string[];
  projectType: string;
}

interface StackOption {
  label: string;
  description: string;
  rationale: string;
  config: StackConfig;
}

interface StackRecommendation {
  recommended: StackOption;
  alternatives: StackOption[];
}

export default function ProjectSetupWizard({
  isOpen,
  projectId,
  onComplete,
  onSkip,
}: ProjectSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('github');
  const [installations, setInstallations] = useState<GitHubInstallation[] | null>(null);
  const [loadingInstallations, setLoadingInstallations] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);
  const [scaffolding, setScaffolding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);

  // Recommendation state
  const [recommendation, setRecommendation] = useState<StackRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<StackConfig | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [expandedAlt, setExpandedAlt] = useState<number | null>(null);

  // Analyze (existing repo) state
  const [analyzeIntent, setAnalyzeIntent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeComplete, setAnalyzeComplete] = useState(false);

  // Fetch GitHub installations and user's GitHub connection on mount
  useEffect(() => {
    if (!isOpen) return;
    setLoadingInstallations(true);
    Promise.all([
      gql<{ githubInstallations: GitHubInstallation[] }>(GITHUB_INSTALLATIONS_QUERY),
      gql<{ me: MeResponse | null }>(ME_QUERY),
    ])
      .then(([instData, meData]) => {
        setInstallations(instData.githubInstallations);
        if (instData.githubInstallations.length > 0) {
          setSelectedInstallation(instData.githubInstallations[0].installationId);
        }
        setGithubLogin(meData.me?.githubLogin ?? null);
      })
      .catch(() => setInstallations([]))
      .finally(() => setLoadingInstallations(false));

    // Listen for GitHub OAuth popup completion
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'github-oauth-success') {
        setGithubLogin(event.data.login);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  // Pre-fetch recommendation as soon as we have a projectId (background fetch during github step)
  useEffect(() => {
    if (!isOpen || !projectId || recommendation || loadingRecommendation) return;
    setLoadingRecommendation(true);
    gql<{ recommendStack: StackRecommendation }>(RECOMMEND_STACK_QUERY, { projectId })
      .then((data) => setRecommendation(data.recommendStack))
      .catch(() => {/* Will retry when reaching recommend step */})
      .finally(() => setLoadingRecommendation(false));
  }, [isOpen, projectId, recommendation, loadingRecommendation]);

  const handleCreateRepo = useCallback(async () => {
    if (!installations || !selectedInstallation) return;
    const installation = installations.find((i) => i.installationId === selectedInstallation);
    if (!installation) return;
    setCreatingRepo(true);
    setError(null);
    try {
      await gql<{ createGitHubRepo: GitHubRepoLink }>(CREATE_GITHUB_REPO_MUTATION, {
        projectId,
        installationId: installation.installationId,
        ownerLogin: installation.accountLogin,
      });
      setStep('recommend');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setCreatingRepo(false);
    }
  }, [installations, selectedInstallation, projectId]);

  const selectedInst = installations?.find((i) => i.installationId === selectedInstallation);
  const isUserAccount = selectedInst?.accountType === 'User';
  const needsGitHubAuth = isUserAccount && !githubLogin;

  const handleConnectGitHub = useCallback(() => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open('/api/auth/github', 'github-oauth', `width=${width},height=${height},left=${left},top=${top}`);
  }, []);

  const handleRepoConnected = useCallback(() => {
    setShowRepoModal(false);
    setStep('analyze');
  }, []);

  const handleSelectConfig = useCallback((config: StackConfig) => {
    setSelectedConfig(config);
    setStep('scaffolding');
  }, []);

  const handleCustomScaffold = useCallback(() => {
    if (!customDescription.trim()) return;
    setSelectedConfig(null);
    setStep('scaffolding');
  }, [customDescription]);

  const handleScaffold = useCallback(async () => {
    setScaffolding(true);
    setError(null);
    try {
      const variables: Record<string, unknown> = { projectId };
      if (selectedConfig) {
        variables.config = selectedConfig;
      } else {
        // Custom description — use a generic config and pass description as options
        variables.config = { framework: 'custom', language: 'custom', packages: [], projectType: 'full-stack' };
        variables.options = customDescription;
      }
      const data = await gql<{ scaffoldProject: ScaffoldResult }>(SCAFFOLD_PROJECT_MUTATION, variables);
      setScaffoldResult(data.scaffoldProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scaffold project');
    } finally {
      setScaffolding(false);
    }
  }, [projectId, selectedConfig, customDescription]);

  // Trigger scaffold when entering the scaffolding step
  useEffect(() => {
    if (step === 'scaffolding' && !scaffoldResult && !scaffolding && !error) {
      void handleScaffold();
    }
  }, [step, scaffoldResult, scaffolding, error, handleScaffold]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await gql<{ bootstrapProjectFromRepo: unknown[] }>(BOOTSTRAP_REPO_MUTATION, { projectId });
      setAnalyzeComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository');
    } finally {
      setAnalyzing(false);
    }
  }, [projectId]);

  // Handle done step
  useEffect(() => {
    if (step === 'done') {
      onComplete();
    }
  }, [step, onComplete]);

  // Retry recommendation fetch if it failed and we're on the recommend step
  useEffect(() => {
    if (step === 'recommend' && !recommendation && !loadingRecommendation) {
      setLoadingRecommendation(true);
      gql<{ recommendStack: StackRecommendation }>(RECOMMEND_STACK_QUERY, { projectId })
        .then((data) => setRecommendation(data.recommendStack))
        .catch(() => setError('Failed to generate stack recommendations'))
        .finally(() => setLoadingRecommendation(false));
    }
  }, [step, recommendation, loadingRecommendation, projectId]);

  const hasInstallations = installations && installations.length > 0;

  return (
    <>
      <Modal isOpen={isOpen && !showRepoModal} onClose={onSkip} title="Set Up Your Project" size="lg" closeOnOverlayClick={!creatingRepo && !scaffolding && !analyzing && step === 'github'}>
        <div className="p-6">
          {step === 'github' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  Connect to GitHub
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Link a repository to enable code generation, pull requests, and more.
                </p>
              </div>

              {loadingInstallations ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                </div>
              ) : !hasInstallations ? (
                <div className="text-center space-y-4">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    The TaskToad GitHub App needs to be installed first. You can set this up later in Org Settings.
                  </p>
                  <Button variant="ghost" onClick={() => setStep('done')}>
                    Skip for now
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {installations.length > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">GitHub account</label>
                      <select
                        value={selectedInstallation ?? ''}
                        onChange={(e) => setSelectedInstallation(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        {installations.map((inst) => (
                          <option key={inst.installationId} value={inst.installationId}>
                            {inst.accountLogin} ({inst.accountType.toLowerCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowRepoModal(true)}
                    className="w-full text-left p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Connect existing repo</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                      Link an existing GitHub repository to this project.
                    </p>
                  </button>

                  {needsGitHubAuth && (
                    <button
                      type="button"
                      onClick={handleConnectGitHub}
                      className="w-full text-left p-4 rounded-lg border-2 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 hover:border-violet-500 dark:hover:border-violet-400 transition-colors"
                    >
                      <p className="font-semibold text-violet-800 dark:text-violet-200">Connect GitHub Account</p>
                      <p className="text-violet-600 dark:text-violet-400 text-sm mt-1">
                        Required to create repos on your personal account. One-time authorization.
                      </p>
                    </button>
                  )}

                  {isUserAccount && githubLogin && (
                    <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded p-2">
                      Connected as <span className="font-medium">{githubLogin}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateRepo}
                    disabled={creatingRepo || !selectedInstallation || needsGitHubAuth}
                    className="w-full text-left p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors disabled:opacity-50"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {creatingRepo ? 'Creating repository...' : 'Create new repo'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                      Create a new GitHub repository for this project.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('done')}
                    className="w-full text-center p-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              )}

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'recommend' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  Choose Your Stack
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  AI-recommended tech stack based on your project description.
                </p>
              </div>

              {loadingRecommendation ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Analyzing your project...</p>
                </div>
              ) : recommendation ? (
                <div className="space-y-4">
                  {/* Recommended option */}
                  <button
                    type="button"
                    onClick={() => handleSelectConfig(recommendation.recommended.config)}
                    className="w-full text-left p-4 rounded-lg border-2 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 hover:border-violet-500 dark:hover:border-violet-400 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-violet-800 dark:text-violet-200">{recommendation.recommended.label}</p>
                      <span className="text-xs font-medium bg-violet-200 dark:bg-violet-700 text-violet-700 dark:text-violet-200 px-2 py-0.5 rounded-full">Recommended</span>
                    </div>
                    <p className="text-violet-700 dark:text-violet-300 text-sm">{recommendation.recommended.description}</p>
                    <p className="text-violet-600 dark:text-violet-400 text-xs mt-2">{recommendation.recommended.rationale}</p>
                  </button>

                  {/* Alternatives */}
                  {recommendation.alternatives.map((alt, i) => (
                    <button
                      key={alt.label}
                      type="button"
                      onClick={() => handleSelectConfig(alt.config)}
                      onMouseEnter={() => setExpandedAlt(i)}
                      onMouseLeave={() => setExpandedAlt(null)}
                      className="w-full text-left p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                    >
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{alt.label}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{alt.description}</p>
                      {expandedAlt === i && (
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">{alt.rationale}</p>
                      )}
                    </button>
                  ))}

                  {/* Custom option */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                      Or describe what you want
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCustomScaffold();
                        }}
                        placeholder="e.g. Python Django with PostgreSQL"
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                      <Button onClick={handleCustomScaffold} disabled={!customDescription.trim()}>
                        Scaffold
                      </Button>
                    </div>
                  </div>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setStep('done')}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Skip — I&apos;ll set up code myself
                    </button>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center space-y-4">
                  <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    {error}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => {
                        setError(null);
                        setRecommendation(null);
                      }}
                    >
                      Retry
                    </Button>
                    <Button variant="ghost" onClick={() => setStep('done')}>
                      Skip
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === 'analyze' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  Analyze Your Repository
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  We&apos;ll scan your repo to understand the codebase and generate a project profile.
                </p>
              </div>

              {!analyzing && !analyzeComplete && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      What would you like to build? <span className="text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      value={analyzeIntent}
                      onChange={(e) => setAnalyzeIntent(e.target.value)}
                      placeholder="Describe your goals, upcoming features, or what you'd like TaskToad to help with..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button onClick={handleAnalyze}>
                      Analyze &amp; Plan
                    </Button>
                    <Button variant="ghost" onClick={() => setStep('done')}>
                      Skip
                    </Button>
                  </div>
                </div>
              )}

              {analyzing && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
                  <p className="text-slate-600 dark:text-slate-400">Analyzing your repository...</p>
                </div>
              )}

              {analyzeComplete && (
                <div className="text-center space-y-4 py-4">
                  <div className="text-3xl text-green-500">&#10003;</div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Repository analyzed
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">
                    Your project profile and knowledge base have been generated from the repo contents.
                  </p>
                  <div>
                    <Button onClick={() => setStep('done')}>Continue</Button>
                  </div>
                </div>
              )}

              {error && !analyzing && !analyzeComplete && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'scaffolding' && (
            <div className="text-center space-y-4 py-8">
              {scaffolding && (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500 mx-auto" />
                  <p className="text-slate-600 dark:text-slate-400">Generating project files...</p>
                </>
              )}

              {!scaffolding && scaffoldResult && (
                <>
                  <div className="text-3xl text-green-500">&#10003;</div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Created {scaffoldResult.filesCreated} files
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">
                    {scaffoldResult.summary}
                  </p>
                  {scaffoldResult.commitUrl && (
                    <a
                      href={scaffoldResult.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      View commit on GitHub
                    </a>
                  )}
                  <div>
                    <Button onClick={() => setStep('done')}>Continue</Button>
                  </div>
                </>
              )}

              {!scaffolding && error && (
                <>
                  <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3 inline-block">
                    {error}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => {
                        setError(null);
                        setScaffoldResult(null);
                        void handleScaffold();
                      }}
                    >
                      Retry
                    </Button>
                    <Button variant="ghost" onClick={() => setStep('done')}>
                      Skip
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {showRepoModal && installations && (
        <GitHubRepoModalWrapper
          projectId={projectId}
          installations={installations}
          onConnected={handleRepoConnected}
          onClose={() => setShowRepoModal(false)}
        />
      )}
    </>
  );
}

// Lazy wrapper to avoid importing GitHubRepoModal at the top level
function GitHubRepoModalWrapper({
  projectId,
  installations,
  onConnected,
  onClose,
}: {
  projectId: string;
  installations: GitHubInstallation[];
  onConnected: () => void;
  onClose: () => void;
}) {
  const [GitHubRepoModal, setGitHubRepoModal] = useState<React.ComponentType<{
    projectId: string;
    installations: GitHubInstallation[];
    currentRepo: GitHubRepoLink | null;
    onConnected: (repo: GitHubRepoLink) => void;
    onDisconnected: () => void;
    onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    import('./GitHubRepoModal').then((mod) => setGitHubRepoModal(() => mod.default));
  }, []);

  if (!GitHubRepoModal) return null;

  return (
    <GitHubRepoModal
      projectId={projectId}
      installations={installations}
      currentRepo={null}
      onConnected={() => onConnected()}
      onDisconnected={() => {}}
      onClose={onClose}
    />
  );
}
