import { githubRequest } from './githubAppClient.js';
import { getInstallationToken } from './githubAppAuth.js';
import type { GitHubRepoLink } from './githubTypes.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('github');

const GET_TREE = `
  query GetTree($owner: String!, $name: String!, $expression: String!) {
    repository(owner: $owner, name: $name) {
      object(expression: $expression) {
        ... on Tree {
          entries { name type path object { ... on Blob { byteSize } } }
        }
      }
    }
  }
`;

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.cache']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.sql', '.prisma', '.graphql', '.css', '.scss']);
const MAX_FILES = 30;

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

interface TreeEntry {
  name: string;
  type: string;
  path: string;
  object: { byteSize?: number } | null;
}

interface TreeResponse {
  repository: {
    object: {
      entries: TreeEntry[];
    } | null;
  };
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

function isCodeFile(name: string): boolean {
  return CODE_EXTENSIONS.has(getExtension(name));
}

async function fetchTreeEntries(
  token: string,
  owner: string,
  name: string,
  expression: string
): Promise<TreeEntry[]> {
  const result = await githubRequest<TreeResponse>(token, GET_TREE, { owner, name, expression });
  return result.repository.object?.entries ?? [];
}

export async function fetchProjectFileTree(repo: GitHubRepoLink): Promise<ProjectFile[]> {
  try {
    const token = await getInstallationToken(repo.installationId);
    const branch = repo.defaultBranch;

    // Fetch root and common subdirectories for deeper coverage
    const expressions = [
      `${branch}:`,
      `${branch}:src`,
      `${branch}:apps`,
    ];

    const allEntries: TreeEntry[] = [];
    for (const expr of expressions) {
      try {
        const entries = await fetchTreeEntries(token, repo.repositoryOwner, repo.repositoryName, expr);
        allEntries.push(...entries);
      } catch {
        // Directory may not exist — skip
      }
    }

    // Deduplicate by path and filter
    const seen = new Set<string>();
    const files: ProjectFile[] = [];

    for (const entry of allEntries) {
      if (entry.type !== 'blob') continue;
      if (isIgnoredDir(entry.name)) continue;
      if (!isCodeFile(entry.name)) continue;
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);

      const ext = getExtension(entry.name);
      files.push({
        path: entry.path,
        language: EXTENSION_TO_LANGUAGE[ext] ?? '',
        size: entry.object?.byteSize ?? 0,
      });
    }

    // Sort by size descending, cap at MAX_FILES
    files.sort((a, b) => b.size - a.size);
    return files.slice(0, MAX_FILES);
  } catch (error) {
    log.error({ error }, 'Failed to fetch project file tree');
    return [];
  }
}
