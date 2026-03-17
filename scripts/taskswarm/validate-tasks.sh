#!/usr/bin/env bash
set -euo pipefail

# Usage: validate-tasks.sh [tasks.json]
# Validates task file arrays: checks for missing files, typos, and cross-worker conflicts.

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS_FILE="${1:-$MAIN_REPO/.ai/taskswarm/tasks.json}"

if [ ! -f "$TASKS_FILE" ]; then
  echo "Error: tasks file not found: $TASKS_FILE"
  exit 1
fi

echo "=== Validating task file assignments ==="
echo "Tasks file: $TASKS_FILE"
echo ""

ERRORS=0
WARNINGS=0

# Extract tasks as JSON lines: id, assignee, files[]
TASK_DATA=$(node -e "
const tasks = JSON.parse(require('fs').readFileSync('$TASKS_FILE', 'utf8')).tasks;
tasks.forEach(t => {
  console.log(JSON.stringify({ id: t.id, assignee: t.assignee, files: t.files || [] }));
});
")

# Track file -> worker assignments for conflict detection
declare -A FILE_OWNERS

echo "--- File existence check ---"
while IFS= read -r line; do
  TASK_ID=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.id)")
  ASSIGNEE=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.assignee)")
  FILES=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));d.files.forEach(f=>console.log(f))")

  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    FULL_PATH="$MAIN_REPO/$filepath"

    # Check if file exists (new files are OK — just flag them)
    if [ ! -f "$FULL_PATH" ]; then
      PARENT_DIR=$(dirname "$FULL_PATH")
      # Walk up to find the deepest existing ancestor
      CHECK_DIR="$PARENT_DIR"
      DEPTH=0
      while [ "$CHECK_DIR" != "$MAIN_REPO" ] && [ ! -d "$CHECK_DIR" ]; do
        CHECK_DIR=$(dirname "$CHECK_DIR")
        DEPTH=$((DEPTH + 1))
      done
      if [ "$DEPTH" -gt 3 ]; then
        # More than 3 levels of missing directories — likely a typo
        echo "  ERROR  $TASK_ID ($ASSIGNEE): $filepath — path looks invalid (typo?)"
        ERRORS=$((ERRORS + 1))
      elif [ ! -d "$PARENT_DIR" ]; then
        # Parent missing — new directory (e.g., new package)
        echo "  WARN   $TASK_ID ($ASSIGNEE): $filepath — new directory will be created"
        WARNINGS=$((WARNINGS + 1))
      else
        echo "  NEW    $TASK_ID ($ASSIGNEE): $filepath — file will be created"
      fi
    else
      echo "  OK     $TASK_ID ($ASSIGNEE): $filepath"
    fi

    # Track for conflict detection
    KEY="$filepath"
    if [ -n "${FILE_OWNERS[$KEY]:-}" ]; then
      EXISTING="${FILE_OWNERS[$KEY]}"
      # Only flag if different workers
      EXISTING_WORKER=$(echo "$EXISTING" | cut -d'|' -f2)
      if [ "$EXISTING_WORKER" != "$ASSIGNEE" ]; then
        FILE_OWNERS["$KEY"]="${EXISTING},$TASK_ID|$ASSIGNEE"
      else
        FILE_OWNERS["$KEY"]="${EXISTING},$TASK_ID|$ASSIGNEE"
      fi
    else
      FILE_OWNERS["$KEY"]="$TASK_ID|$ASSIGNEE"
    fi
  done <<< "$FILES"
done <<< "$TASK_DATA"

echo ""
echo "--- Cross-worker file conflicts ---"
CONFLICTS=0
for filepath in "${!FILE_OWNERS[@]}"; do
  OWNERS="${FILE_OWNERS[$filepath]}"
  # Check if multiple different workers own this file
  WORKERS=$(echo "$OWNERS" | tr ',' '\n' | cut -d'|' -f2 | sort -u)
  WORKER_COUNT=$(echo "$WORKERS" | wc -l)
  if [ "$WORKER_COUNT" -gt 1 ]; then
    echo "  CONFLICT: $filepath"
    echo "    Assigned to: $OWNERS"
    CONFLICTS=$((CONFLICTS + 1))
    ERRORS=$((ERRORS + 1))
  fi
done
if [ "$CONFLICTS" -eq 0 ]; then
  echo "  No cross-worker file conflicts found."
fi

echo ""
echo "=== Summary ==="
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Fix errors before starting the swarm."
  exit 1
fi

echo "All checks passed."
