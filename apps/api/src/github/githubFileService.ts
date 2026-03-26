import { getInstallationToken } from './githubAppAuth.js';
import type { GitHubRepoLink } from './githubTypes.js';
import { createChildLogger } from '../utils/logger.js';
import { getCached, setCache } from './githubCache.js';

const log = createChildLogger('github');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.cache']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.sql', '.prisma', '.graphql', '.css', '.scss']);
const MAX_FILES = 100;

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.sql': 'sql',
  '.prisma': 'prisma',
  '.graphql': 'graphql',
  '.css': 'css',
  '.scss': 'scss',
};

export interface ProjectFile {
  path: string;
  language: string;
  size: number;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

function isIgnoredPath(path: string): boolean {
  return path.split('/').some((seg) => IGNORED_DIRS.has(seg));
}

function isCodeFile(name: string): boolean {
  return CODE_EXTENSIONS.has(getExtension(name));
}

/** REST recursive tree entry from GitHub API. */
interface RestTreeEntry {
  path: string;
  mode: string;
  type: string;
  size?: number;
  sha: string;
}

/**
 * Fetch the content of a single file from a GitHub repository.
 * Returns null if the file doesn't exist.
 */
export async function fetchFileContent(
  installationId: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  const token = await getInstallationToken(installationId);
  const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${refParam}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    log.error({ status: response.status, path }, 'Failed to fetch file content');
    return null;
  }

  const data = (await response.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== 'base64') return null;

  return Buffer.from(data.content, 'base64').toString('utf8');
}

export async function fetchProjectFileTree(repo: GitHubRepoLink, branch?: string): Promise<ProjectFile[]> {
  const resolvedBranch = branch ?? repo.defaultBranch;
  const cacheKey = `filetree:${repo.repositoryOwner}:${repo.repositoryName}:${resolvedBranch}`;
  const cached = getCached<ProjectFile[]>(cacheKey);
  if (cached) return cached;

  try {
    const token = await getInstallationToken(repo.installationId);

    // Use REST recursive tree API — returns the full tree in one call
    const url = `https://api.github.com/repos/${encodeURIComponent(repo.repositoryOwner)}/${encodeURIComponent(repo.repositoryName)}/git/trees/${encodeURIComponent(resolvedBranch)}?recursive=1`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch recursive tree');
      return [];
    }

    const data = (await response.json()) as { tree: RestTreeEntry[]; truncated: boolean };
    if (data.truncated) {
      log.warn('Recursive tree was truncated by GitHub — very large repo');
    }

    const files: ProjectFile[] = [];
    for (const entry of data.tree) {
      if (entry.type !== 'blob') continue;
      if (isIgnoredPath(entry.path)) continue;
      if (!isCodeFile(entry.path)) continue;

      const ext = getExtension(entry.path);
      files.push({
        path: entry.path,
        language: EXTENSION_TO_LANGUAGE[ext] ?? '',
        size: entry.size ?? 0,
      });
    }

    // Sort by size descending, cap at MAX_FILES
    files.sort((a, b) => b.size - a.size);
    const result = files.slice(0, MAX_FILES);
    setCache(cacheKey, result, 21_600_000); // 6 hour TTL
    return result;
  } catch (error) {
    log.error({ error }, 'Failed to fetch project file tree');
    return [];
  }
}

/**
 * Fetch file content with caching (30-minute TTL).
 * Wrapper around fetchFileContent for repeated access to the same files.
 */
export async function fetchFileContentCached(
  installationId: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  const cacheKey = `filecontent:${owner}:${repo}:${path}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const content = await fetchFileContent(installationId, owner, repo, path, ref);
  if (content) {
    setCache(cacheKey, content, 1_800_000); // 30 min TTL
  }
  return content;
}

// ---------------------------------------------------------------------------
// Recent commits & open PRs (REST API)
// ---------------------------------------------------------------------------

export interface RecentCommit {
  sha: string;
  message: string;
  date: string;
}

export async function listRecentCommits(
  installationId: string,
  owner: string,
  repo: string,
  count = 30
): Promise<RecentCommit[]> {
  try {
    const token = await getInstallationToken(installationId);
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${count}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch recent commits');
      return [];
    }
    const data = (await response.json()) as Array<{ sha: string; commit: { message: string; committer: { date: string } | null } }>;
    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.committer?.date ?? '',
    }));
  } catch (error) {
    log.error({ error }, 'Failed to fetch recent commits');
    return [];
  }
}

export interface OpenPR {
  title: string;
  state: string;
  number: number;
}

export async function listOpenPullRequests(
  installationId: string,
  owner: string,
  repo: string
): Promise<OpenPR[]> {
  try {
    const token = await getInstallationToken(installationId);
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=10`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch open PRs');
      return [];
    }
    const data = (await response.json()) as Array<{ title: string; state: string; number: number }>;
    return data.map((pr) => ({ title: pr.title, state: pr.state, number: pr.number }));
  } catch (error) {
    log.error({ error }, 'Failed to fetch open PRs');
    return [];
  }
}
