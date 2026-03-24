import { useState, useEffect, useCallback } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import { gql } from '../api/client';
import {
  GITHUB_INSTALLATIONS_QUERY,
  SCAFFOLD_PROJECT_MUTATION,
  CREATE_GITHUB_REPO_MUTATION,
} from '../api/queries';
import type { GitHubInstallation, GitHubRepoLink } from '../types';

interface ProjectSetupWizardProps {
  isOpen: boolean;
  projectId: string;
  onComplete: () => void;
  onSkip: () => void;
}

type WizardStep = 'github' | 'template' | 'scaffolding' | 'done';

interface ScaffoldResult {
  success: boolean;
  filesCreated: number;
  summary: string;
  commitUrl: string | null;
}

interface ScaffoldTemplate {
  name: string;
  label: string;
  description: string;
}

const SCAFFOLD_TEMPLATES_QUERY = `query { scaffoldTemplates { name label description } }`;

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);
  const [scaffolding, setScaffolding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [templates, setTemplates] = useState<ScaffoldTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch GitHub installations on mount
  useEffect(() => {
    if (!isOpen) return;
    setLoadingInstallations(true);
    gql<{ githubInstallations: GitHubInstallation[] }>(GITHUB_INSTALLATIONS_QUERY)
      .then((data) => setInstallations(data.githubInstallations))
      .catch(() => setInstallations([]))
      .finally(() => setLoadingInstallations(false));
  }, [isOpen]);

  // Fetch scaffold templates when reaching template step
  useEffect(() => {
    if (step !== 'template' || templates.length > 0) return;
    setLoadingTemplates(true);
    gql<{ scaffoldTemplates: ScaffoldTemplate[] }>(SCAFFOLD_TEMPLATES_QUERY)
      .then((data) => setTemplates(data.scaffoldTemplates))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [step, templates.length]);

  const handleCreateRepo = useCallback(async () => {
    if (!installations || installations.length === 0) return;
    setCreatingRepo(true);
    setError(null);
    try {
      await gql<{ createGitHubRepo: GitHubRepoLink }>(CREATE_GITHUB_REPO_MUTATION, {
        projectId,
        installationId: installations[0].installationId,
        ownerLogin: installations[0].accountLogin,
      });
      setStep('template');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setCreatingRepo(false);
    }
  }, [installations, projectId]);

  const handleRepoConnected = useCallback(() => {
    setShowRepoModal(false);
    setStep('template');
  }, []);

  const handleSelectTemplate = useCallback((template: string) => {
    setSelectedTemplate(template);
    setStep('scaffolding');
  }, []);

  const handleScaffold = useCallback(async (template: string) => {
    setScaffolding(true);
    setError(null);
    try {
      const data = await gql<{ scaffoldProject: ScaffoldResult }>(SCAFFOLD_PROJECT_MUTATION, {
        projectId,
        template,
      });
      setScaffoldResult(data.scaffoldProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scaffold project');
    } finally {
      setScaffolding(false);
    }
  }, [projectId]);

  // Trigger scaffold when entering the scaffolding step
  useEffect(() => {
    if (step === 'scaffolding' && selectedTemplate && !scaffoldResult && !scaffolding && !error) {
      void handleScaffold(selectedTemplate);
    }
  }, [step, selectedTemplate, scaffoldResult, scaffolding, error, handleScaffold]);

  // Handle done step
  useEffect(() => {
    if (step === 'done') {
      onComplete();
    }
  }, [step, onComplete]);

  const hasInstallations = installations && installations.length > 0;

  return (
    <>
      <Modal isOpen={isOpen && !showRepoModal} onClose={onSkip} title="Set Up Your Project" size="lg">
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

                  <button
                    type="button"
                    onClick={handleCreateRepo}
                    disabled={creatingRepo}
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

          {step === 'template' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  Choose a Template
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Scaffold your project with a starter template.
                </p>
              </div>

              {loadingTemplates ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleSelectTemplate(t.name)}
                    className="text-left p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{t.label}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
              )}

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
                        void handleScaffold(selectedTemplate!);
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
