#!/usr/bin/env bash
set -euo pipefail

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PARENT_DIR="$(dirname "$MAIN_REPO")"
REPO_NAME="$(basename "$MAIN_REPO")"
TESTER_COUNT="${1:-3}"
DEBUGGER_COUNT="${2:-1}"
BUGS_FILE="$MAIN_REPO/.ai/bugs/bugs.json"

echo "=== Spawning test swarm ==="
echo "Main repo: $MAIN_REPO"
echo "Testers: $TESTER_COUNT | Debuggers: $DEBUGGER_COUNT"
echo ""

# Initialize bug queue
node -e "
const data = {
  version: 1,
  created: new Date().toISOString(),
  bugs: []
};
require('fs').writeFileSync('$BUGS_FILE', JSON.stringify(data, null, 2) + '\n');
"

# Initialize test data tracker
TRACKER_FILE="$MAIN_REPO/.ai/bugs/test-data.json"
node -e "
const data = {users:[],orgs:[],projects:[],tasks:[],sprints:[],comments:[],labels:[],webhooks:[],slackIntegrations:[]};
require('fs').writeFileSync('$TRACKER_FILE', JSON.stringify(data, null, 2) + '\n');
"

# Testers don't need worktrees — they test against the live server.
# They run from the main repo directory.
echo "Testers will run from: $MAIN_REPO"
echo "(No worktrees needed — testers are read-only against the live server)"
echo ""

# Create debugger worktrees (they need to edit code)
for i in $(seq 1 "$DEBUGGER_COUNT"); do
  DEBUGGER_DIR="$PARENT_DIR/${REPO_NAME}-debugger-$i"
  BRANCH="testswarm/debugger-$i"

  if [ -d "$DEBUGGER_DIR" ]; then
    echo "Warning: $DEBUGGER_DIR already exists, skipping"
    continue
  fi

  echo "Creating debugger-$i worktree..."
  git -C "$MAIN_REPO" worktree add -b "$BRANCH" "$DEBUGGER_DIR" HEAD

  # Copy env files
  for f in "$MAIN_REPO/apps/api/.env" "$MAIN_REPO/apps/web/.env"; do
    [ -f "$f" ] && cp "$f" "$DEBUGGER_DIR/${f#$MAIN_REPO/}"
  done

  # Install deps + generate Prisma
  (cd "$DEBUGGER_DIR" && pnpm install --frozen-lockfile --prefer-offline 2>/dev/null) || true
  (cd "$DEBUGGER_DIR/apps/api" && npx prisma generate 2>&1) || echo "Warning: prisma generate failed (non-fatal)"

  # Grant full permissions for unattended operation
  mkdir -p "$DEBUGGER_DIR/.claude"
  cat > "$DEBUGGER_DIR/.claude/settings.json" << 'SETTINGS_EOF'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)",
      "WebSearch(*)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push *)",
      "Bash(git reset --hard *)",
      "Bash(git clean *)",
      "Bash(docker rm *)",
      "Bash(docker system *)"
    ]
  }
}
SETTINGS_EOF
  git -C "$DEBUGGER_DIR" update-index --assume-unchanged .claude/settings.json

  echo "  -> $DEBUGGER_DIR (branch: $BRANCH)"
done

echo ""
echo "=== Test swarm ready ==="
echo "Bug queue: $BUGS_FILE"
echo ""
echo "Next steps:"
echo "  1. Ensure dev server is running: pnpm dev"
echo "  2. Start testers (each in a separate terminal from $MAIN_REPO):"
for i in $(seq 1 "$TESTER_COUNT"); do
  echo "     Tester $i: cd $MAIN_REPO && claude"
done
echo "  3. Start debuggers:"
for i in $(seq 1 "$DEBUGGER_COUNT"); do
  echo "     Debugger $i: cd $PARENT_DIR/${REPO_NAME}-debugger-$i && claude"
done
echo ""
echo "  Tester prompt:  /test-worker api|ui|edge"
echo "  Debugger prompt: /debug-worker"
