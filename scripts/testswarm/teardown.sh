#!/usr/bin/env bash
set -euo pipefail

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PARENT_DIR="$(dirname "$MAIN_REPO")"
REPO_NAME="$(basename "$MAIN_REPO")"
BUGS_FILE="$MAIN_REPO/.ai/bugs/bugs.json"

echo "=== Tearing down test swarm ==="

# Clean up bug queue and test data
if [ -d "$MAIN_REPO/.ai/bugs" ]; then
  rm -f "$MAIN_REPO/.ai/bugs/"*.json
  echo "Removed test swarm bug artifacts"
fi

# Remove debugger worktrees
for dir in "$PARENT_DIR/${REPO_NAME}-debugger-"*; do
  [ -d "$dir" ] || continue
  BRANCH=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  echo "Removing worktree: $dir"
  git -C "$MAIN_REPO" worktree remove --force "$dir" 2>/dev/null || rm -rf "$dir"
  git -C "$MAIN_REPO" branch -D "$BRANCH" 2>/dev/null || true
done

echo ""
echo "=== Test swarm torn down ==="
echo "Remaining worktrees:"
git -C "$MAIN_REPO" worktree list
