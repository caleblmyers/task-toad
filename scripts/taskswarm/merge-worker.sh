#!/usr/bin/env bash
set -euo pipefail

# Usage: merge-worker.sh <worker-branch> [--validate]
# Merges a worker branch into main in the main repo.
# Run from any directory — always operates on the main repo.

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: merge-worker.sh <branch> [--validate]"
  echo ""
  echo "Examples:"
  echo "  merge-worker.sh swarm/worker-1"
  echo "  merge-worker.sh swarm/worker-1 --validate"
  echo ""
  echo "Flags:"
  echo "  --validate    Run prisma generate (if needed) + typecheck + lint + test before merging (exits 1 on failure)"
  exit 1
fi

BRANCH="$1"
VALIDATE=false
[ "${2:-}" = "--validate" ] && VALIDATE=true

echo "=== Merging $BRANCH into main ==="

# Ensure we're on main
CURRENT=$(git -C "$MAIN_REPO" branch --show-current)
if [ "$CURRENT" != "main" ]; then
  echo "Error: main repo is on branch '$CURRENT', expected 'main'"
  exit 1
fi

# Show what will be merged
echo "Commits to merge:"
git -C "$MAIN_REPO" log --oneline "main..$BRANCH" 2>/dev/null || {
  echo "Error: branch '$BRANCH' not found"
  exit 1
}
echo ""

# Validate if requested
if [ "$VALIDATE" = true ]; then
  echo "Running validation..."
  # Temporarily merge to test
  git -C "$MAIN_REPO" merge --no-commit --no-ff "$BRANCH" 2>/dev/null || {
    echo "Error: merge conflicts detected"
    git -C "$MAIN_REPO" merge --abort
    exit 1
  }

  # Install deps if any package.json changed (new npm packages)
  if git -C "$MAIN_REPO" diff --cached --name-only | grep -q 'package.json'; then
    echo "package.json changes detected — running pnpm install..."
    if ! (cd "$MAIN_REPO" && pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1); then
      echo "pnpm install failed — aborting merge"
      git -C "$MAIN_REPO" merge --abort
      exit 1
    fi
  fi

  # Regenerate Prisma client if schema files changed
  if git -C "$MAIN_REPO" diff --cached --name-only | grep -q 'prisma/schema/'; then
    echo "Prisma schema changes detected — running prisma generate..."
    if ! (cd "$MAIN_REPO/apps/api" && npx prisma generate 2>&1); then
      echo "Prisma generate failed — aborting merge"
      git -C "$MAIN_REPO" merge --abort
      exit 1
    fi
  fi

  if ! (cd "$MAIN_REPO" && pnpm typecheck 2>&1); then
    echo "Typecheck failed — aborting merge"
    git -C "$MAIN_REPO" merge --abort
    exit 1
  fi
  if ! (cd "$MAIN_REPO" && pnpm lint 2>&1); then
    echo "Lint failed — aborting merge"
    git -C "$MAIN_REPO" merge --abort
    exit 1
  fi
  if ! (cd "$MAIN_REPO" && pnpm test 2>&1); then
    echo "Tests failed — aborting merge"
    git -C "$MAIN_REPO" merge --abort
    exit 1
  fi
  # Abort the test merge, we'll do the real one below
  git -C "$MAIN_REPO" merge --abort
fi

# Squash merge
git -C "$MAIN_REPO" merge --squash "$BRANCH" || {
  echo "Error: merge conflicts. Resolve manually or ask the worker to rebase."
  git -C "$MAIN_REPO" merge --abort 2>/dev/null || true
  exit 1
}

# Strip swarm role content from CLAUDE.md if present
CLAUDE_MD="$MAIN_REPO/CLAUDE.md"
if [ -f "$CLAUDE_MD" ] && grep -q '<!-- swarm-role -->' "$CLAUDE_MD"; then
  echo "Stripping swarm role content from CLAUDE.md..."
  # Remove everything from the delimiter line onwards
  sed -i '/<!-- swarm-role -->/,$d' "$CLAUDE_MD"
  # Remove any trailing blank lines left behind
  sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$CLAUDE_MD"
  git -C "$MAIN_REPO" add CLAUDE.md
fi

echo ""
echo "Squash merge staged. Review with 'git diff --cached' then commit."
echo "Suggested: git commit -m 'swarm(<worker>): [task-XXX] description'"
