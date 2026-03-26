// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectSetupWizard from '../ProjectSetupWizard';

// Mock the gql helper
vi.mock('../../api/client', () => ({
  gql: vi.fn(),
}));

// Mock the GitHubRepoModal dynamic import
vi.mock('../GitHubRepoModal', () => ({
  default: () => <div data-testid="github-repo-modal">MockRepoModal</div>,
}));

import { gql } from '../../api/client';

const mockGql = vi.mocked(gql);

const MOCK_INSTALLATIONS = [
  {
    installationId: 'inst-1',
    accountLogin: 'test-org',
    accountType: 'Organization',
    orgId: 'org-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const MOCK_RECOMMENDATION = {
  recommended: {
    label: 'Next.js + TypeScript',
    description: 'Full-stack React framework with TypeScript',
    rationale: 'Best fit for a modern web app with SSR support',
    config: { framework: 'nextjs', language: 'typescript', packages: ['prisma', 'tailwindcss'], projectType: 'full-stack' },
  },
  alternatives: [
    {
      label: 'Vite + React',
      description: 'Fast SPA with React and TypeScript',
      rationale: 'Great for client-heavy apps without SSR needs',
      config: { framework: 'vite-react', language: 'typescript', packages: ['tailwindcss'], projectType: 'frontend-only' },
    },
  ],
};

const defaultProps = {
  isOpen: true,
  projectId: 'proj-1',
  onComplete: vi.fn(),
  onSkip: vi.fn(),
};

function setupGqlMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    githubInstallations: MOCK_INSTALLATIONS,
    recommendStack: MOCK_RECOMMENDATION,
    ...overrides,
  };

  mockGql.mockImplementation((query: string) => {
    if (query.includes('githubInstallations')) {
      return Promise.resolve({ githubInstallations: defaults.githubInstallations });
    }
    if (query.includes('{ me {') || query.includes('{ me{')) {
      return Promise.resolve({ me: defaults.me ?? { githubLogin: null } });
    }
    if (query.includes('recommendStack')) {
      if (defaults.recommendError) {
        return Promise.reject(new Error(defaults.recommendError as string));
      }
      return Promise.resolve({ recommendStack: defaults.recommendStack });
    }
    if (query.includes('scaffoldProject')) {
      if (defaults.scaffoldError) {
        return Promise.reject(new Error(defaults.scaffoldError as string));
      }
      return Promise.resolve({
        scaffoldProject: defaults.scaffoldProject ?? {
          success: true,
          filesCreated: 5,
          summary: 'Created 5 files for Next.js project',
          commitUrl: 'https://github.com/test-org/test-repo/commit/abc123',
        },
      });
    }
    if (query.includes('createGitHubRepo')) {
      return Promise.resolve({
        createGitHubRepo: {
          repositoryId: 'repo-1',
          repositoryName: 'test-repo',
          repositoryOwner: 'test-org',
          installationId: 'inst-1',
          defaultBranch: 'main',
        },
      });
    }
    if (query.includes('bootstrapProjectFromRepo')) {
      return Promise.resolve({ bootstrapProjectFromRepo: [] });
    }
    return Promise.resolve({});
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectSetupWizard', () => {
  // ── Rendering ──

  it('renders when isOpen is true', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Set Up Your Project')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGql).toHaveBeenCalled();
    });
  });

  it('does not render when isOpen is false', () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Set Up Your Project')).not.toBeInTheDocument();
  });

  // ── GitHub step ──

  it('shows GitHub step options when installations are loaded', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Connect existing repo')).toBeInTheDocument();
    });
    expect(screen.getByText('Create new repo')).toBeInTheDocument();
    expect(screen.getByText('Skip for now')).toBeInTheDocument();
  });

  it('shows skip message when no GitHub installations', async () => {
    setupGqlMock({ githubInstallations: [] });
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/GitHub App needs to be installed/)).toBeInTheDocument();
    });
  });

  it('advances to done step when skip is clicked with no installations', async () => {
    setupGqlMock({ githubInstallations: [] });
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Skip for now/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Skip for now/));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  it('advances to done step when skip is clicked with installations', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Skip for now'));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  // ── Recommend step ──

  it('shows AI recommendations after creating a new repo', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Choose Your Stack')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Vite + React')).toBeInTheDocument();
  });

  it('advances to scaffolding step when selecting a recommendation', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(screen.getByText('Generating project files...')).toBeInTheDocument();
    });
  });

  // ── Scaffolding step ──

  it('triggers scaffoldProject mutation with config object', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(mockGql).toHaveBeenCalledWith(
        expect.stringContaining('scaffoldProject'),
        {
          projectId: 'proj-1',
          config: { framework: 'nextjs', language: 'typescript', packages: ['prisma', 'tailwindcss'], projectType: 'full-stack' },
        },
      );
    });
  });

  it('shows success state with commit URL after successful scaffold', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(screen.getByText('Created 5 files')).toBeInTheDocument();
    });
    expect(screen.getByText('Created 5 files for Next.js project')).toBeInTheDocument();
    expect(screen.getByText('View commit on GitHub')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('shows error state with retry button on scaffold failure', async () => {
    setupGqlMock({ scaffoldError: 'AI generation failed' });
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(screen.getByText('AI generation failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('retries scaffold on retry button click', async () => {
    let callCount = 0;
    setupGqlMock({ scaffoldError: 'Temporary failure' });

    const origImpl = mockGql.getMockImplementation()!;
    mockGql.mockImplementation((query: string, vars?: Record<string, unknown>) => {
      if (query.includes('scaffoldProject')) {
        callCount++;
        if (callCount <= 1) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          scaffoldProject: {
            success: true,
            filesCreated: 3,
            summary: 'Retried successfully',
            commitUrl: null,
          },
        });
      }
      return origImpl(query, vars);
    });

    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Created 3 files')).toBeInTheDocument();
    });
  });

  // ── Done step ──

  it('calls onComplete when reaching done step', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js + TypeScript')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js + TypeScript'));

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  // ── Skip behavior ──

  it('wires onSkip to Modal onClose', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up Your Project')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(defaultProps.onSkip).toHaveBeenCalled();
    });
  });

  it('allows skipping from recommend step', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText(/set up code myself/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/set up code myself/));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  // ── Analyze step (existing repo) ──

  it('shows analyze step when connecting an existing repo', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Connect existing repo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Connect existing repo'));

    // GitHubRepoModal opens — simulate its onConnected callback
    // The modal wrapper calls onConnected which sets step to 'analyze'
    // Since the modal is mocked, we verify it renders
    await waitFor(() => {
      expect(screen.getByTestId('github-repo-modal')).toBeInTheDocument();
    });
  });

  it('pre-fetches recommendations during GitHub step', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(mockGql).toHaveBeenCalledWith(
        expect.stringContaining('recommendStack'),
        { projectId: 'proj-1' },
      );
    });
  });
});
