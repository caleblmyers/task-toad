import { fetchProjectFileTree, fetchFileContentCached } from './githubFileService.js';
import type { ProjectFile } from './githubFileService.js';
import type { GitHubRepoLink } from './githubTypes.js';
import { estimateTokens } from '../ai/tokenEstimator.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('repoContext');

const MAX_SINGLE_FILE_TOKENS = 8_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelevantFile {
  path: string;
  language: string;
  content: string;
  relevanceReason: string;
}

export interface RepoContext {
  fileTree: ProjectFile[];
  relevantFiles: RelevantFile[];
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

/** Extract meaningful keywords from text (titles, descriptions, instructions). */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
    'this', 'that', 'these', 'those', 'it', 'its', 'not', 'no', 'so',
    'if', 'then', 'than', 'when', 'while', 'as', 'up', 'out', 'into',
    'all', 'each', 'every', 'any', 'some', 'such', 'new', 'add', 'create',
    'update', 'implement', 'make', 'use', 'set', 'get', 'also',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

/** Score a file path 0–1 based on keyword overlap with its path segments. */
export function scoreFileRelevance(filePath: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const pathLower = filePath.toLowerCase();
  const segments = pathLower.split('/');
  const fileName = segments[segments.length - 1] ?? '';
  const dirSegments = segments.slice(0, -1);

  let hits = 0;
  for (const kw of keywords) {
    // Exact segment match (highest signal)
    if (segments.some((s) => s.includes(kw))) {
      hits += 1;
    }
    // Partial path match
    else if (pathLower.includes(kw)) {
      hits += 0.5;
    }
  }

  // Bonus for matching directory names (more likely related)
  const dirBonus = dirSegments.some((d) =>
    keywords.some((kw) => d.includes(kw))
  ) ? 0.2 : 0;

  // Bonus for matching the file name directly
  const fileBonus = keywords.some((kw) => fileName.includes(kw)) ? 0.3 : 0;

  // Bonus for common important files
  const importantBonus =
    fileName === 'index.ts' || fileName === 'index.js' || fileName === 'types.ts'
      ? 0.1
      : 0;

  return Math.min(1, (hits / keywords.length) + dirBonus + fileBonus + importantBonus);
}

// ---------------------------------------------------------------------------
// Code generation context
// ---------------------------------------------------------------------------

/**
 * Resolve relevant files from the repo for code generation context.
 * Fetches the file tree, scores files by relevance to the task, and
 * fetches content for top-N files within the token budget.
 */
export async function resolveCodeGenContext(
  repo: GitHubRepoLink,
  task: { title: string; description?: string | null; instructions?: string | null },
  tokenBudget: number
): Promise<RepoContext> {
  const fileTree = await fetchProjectFileTree(repo);

  const text = [task.title, task.description ?? '', task.instructions ?? ''].join(' ');
  const keywords = extractKeywords(text);

  if (keywords.length === 0) {
    return { fileTree, relevantFiles: [] };
  }

  // Score and sort files
  const scored = fileTree
    .map((f) => ({ file: f, score: scoreFileRelevance(f.path, keywords) }))
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score);

  // Fetch content for top files within budget
  const relevantFiles: RelevantFile[] = [];
  let usedTokens = 0;

  for (const { file, score } of scored.slice(0, 10)) {
    if (usedTokens >= tokenBudget) break;

    const content = await fetchFileContentCached(
      repo.installationId,
      repo.repositoryOwner,
      repo.repositoryName,
      file.path
    );
    if (!content) continue;

    const tokens = estimateTokens(content);
    if (tokens > MAX_SINGLE_FILE_TOKENS) continue; // skip very large files
    if (usedTokens + tokens > tokenBudget) {
      // Try to fit a truncated version if we have budget left
      const remaining = tokenBudget - usedTokens;
      if (remaining > 500) {
        const truncated = content.slice(0, remaining * 4); // ~remaining tokens
        relevantFiles.push({
          path: file.path,
          language: file.language,
          content: truncated,
          relevanceReason: `Score ${score.toFixed(2)} — keyword match (truncated)`,
        });
        usedTokens += remaining;
      }
      break;
    }

    relevantFiles.push({
      path: file.path,
      language: file.language,
      content,
      relevanceReason: `Score ${score.toFixed(2)} — keyword match`,
    });
    usedTokens += tokens;
  }

  log.info({ taskTitle: task.title, filesScored: scored.length, filesFetched: relevantFiles.length, tokensUsed: usedTokens }, 'Resolved code gen context');
  return { fileTree, relevantFiles };
}

// ---------------------------------------------------------------------------
// PR review context
// ---------------------------------------------------------------------------

/**
 * Resolve context for PR review by fetching base-branch versions of
 * changed files and sibling files in the same directories.
 */
export async function resolveReviewContext(
  repo: GitHubRepoLink,
  changedPaths: string[],
  tokenBudget: number
): Promise<RepoContext> {
  const fileTree = await fetchProjectFileTree(repo);

  const relevantFiles: RelevantFile[] = [];
  let usedTokens = 0;

  // 1. Fetch base-branch versions of changed files
  for (const path of changedPaths) {
    if (usedTokens >= tokenBudget) break;

    const content = await fetchFileContentCached(
      repo.installationId,
      repo.repositoryOwner,
      repo.repositoryName,
      path
    );
    if (!content) continue;

    const tokens = estimateTokens(content);
    if (tokens > MAX_SINGLE_FILE_TOKENS) continue;
    if (usedTokens + tokens > tokenBudget) continue;

    relevantFiles.push({
      path,
      language: fileTree.find((f) => f.path === path)?.language ?? '',
      content,
      relevanceReason: 'Changed file (base branch version)',
    });
    usedTokens += tokens;
  }

  // 2. Fetch sibling files in same directories (for pattern context)
  const changedDirs = new Set(changedPaths.map((p) => p.split('/').slice(0, -1).join('/')));
  const siblings = fileTree
    .filter((f) => {
      const dir = f.path.split('/').slice(0, -1).join('/');
      return changedDirs.has(dir) && !changedPaths.includes(f.path);
    })
    .slice(0, 5);

  for (const file of siblings) {
    if (usedTokens >= tokenBudget) break;

    const content = await fetchFileContentCached(
      repo.installationId,
      repo.repositoryOwner,
      repo.repositoryName,
      file.path
    );
    if (!content) continue;

    const tokens = estimateTokens(content);
    if (tokens > MAX_SINGLE_FILE_TOKENS) continue;
    if (usedTokens + tokens > tokenBudget) continue;

    relevantFiles.push({
      path: file.path,
      language: file.language,
      content,
      relevanceReason: 'Sibling file (same directory)',
    });
    usedTokens += tokens;
  }

  log.info({ changedFiles: changedPaths.length, contextFiles: relevantFiles.length, tokensUsed: usedTokens }, 'Resolved review context');
  return { fileTree, relevantFiles };
}
