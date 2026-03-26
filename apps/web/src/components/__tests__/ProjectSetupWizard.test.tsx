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

const MOCK_TEMPLATES = [
  { name: 'nextjs', label: 'Next.js', description: 'React + TypeScript + Tailwind' },
  { name: 'vite-react', label: 'Vite + React', description: 'SPA with TypeScript' },
  { name: 'express-ts', label: 'Express + TypeScript', description: 'Node.js API' },
  { name: 'python-fastapi', label: 'Python + FastAPI', description: 'Python API' },
];

const defaultProps = {
  isOpen: true,
  projectId: 'proj-1',
  onComplete: vi.fn(),
  onSkip: vi.fn(),
};

function setupGqlMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    githubInstallations: MOCK_INSTALLATIONS,
    scaffoldTemplates: MOCK_TEMPLATES,
    ...overrides,
  };

  mockGql.mockImplementation((query: string) => {
    if (query.includes('githubInstallations')) {
      return Promise.resolve({ githubInstallations: defaults.githubInstallations });
    }
    if (query.includes('{ me {') || query.includes('{ me{')) {
      return Promise.resolve({ me: defaults.me ?? { githubLogin: null } });
    }
    if (query.includes('scaffoldTemplates')) {
      return Promise.resolve({ scaffoldTemplates: defaults.scaffoldTemplates });
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

    // Wait for async useEffect to settle (installations + me query)
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

  it('advances to template step when skip is clicked', async () => {
    setupGqlMock({ githubInstallations: [] });
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Skip for now/)).toBeInTheDocument();
    });

    // Clicking skip with no installations goes to done step
    fireEvent.click(screen.getByText(/Skip for now/));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  it('advances to template step after clicking skip with installations', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    // With installations, "Skip for now" goes to done
    fireEvent.click(screen.getByText('Skip for now'));

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled();
    });
  });

  // ── Template step ──

  it('fetches and displays templates from API', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    // Wait for installations to load, then create a repo to advance
    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Choose a Template')).toBeInTheDocument();
    });

    // Templates should be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    expect(screen.getByText('Vite + React')).toBeInTheDocument();
    expect(screen.getByText('Express + TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python + FastAPI')).toBeInTheDocument();

    // Verify scaffoldTemplates query was called
    expect(mockGql).toHaveBeenCalledWith(
      expect.stringContaining('scaffoldTemplates'),
    );
  });

  it('advances to scaffolding step when selecting a template', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next.js'));

    await waitFor(() => {
      expect(screen.getByText('Generating project files...')).toBeInTheDocument();
    });
  });

  // ── Scaffolding step ──

  it('triggers scaffoldProject mutation with correct arguments', async () => {
    setupGqlMock();
    render(<ProjectSetupWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create new repo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create new repo'));

    await waitFor(() => {
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js'));

    await waitFor(() => {
      expect(mockGql).toHaveBeenCalledWith(
        expect.stringContaining('scaffoldProject'),
        { projectId: 'proj-1', template: 'nextjs' },
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
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js'));

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
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js'));

    await waitFor(() => {
      expect(screen.getByText('AI generation failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('retries scaffold on retry button click', async () => {
    // First call fails, second succeeds
    let callCount = 0;
    setupGqlMock({ scaffoldError: 'Temporary failure' });

    // Override to allow retry to succeed
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
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js'));

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
      expect(screen.getByText('Next.js')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next.js'));

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

    // Modal's onClose is wired to onSkip — simulate Escape key
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(defaultProps.onSkip).toHaveBeenCalled();
    });
  });

  it('allows skipping from template step', async () => {
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
});
