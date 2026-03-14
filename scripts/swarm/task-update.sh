#!/usr/bin/env bash
set -euo pipefail

# Usage: task-update.sh <task-id> <status> [--startedAt] [--completedAt] [--reviewedAt] [--reviewNotes="msg"]
# Updates a task's status in tasks.json with optional timestamp/note fields.

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS_FILE="$MAIN_REPO/.ai/swarm/tasks.json"

if [ $# -lt 2 ]; then
  echo "Usage: task-update.sh <task-id> <status> [--startedAt] [--completedAt] [--reviewedAt] [--reviewNotes=\"msg\"]"
  echo ""
  echo "Status: pending, in_progress, completed, review, merged, blocked"
  echo ""
  echo "Flags:"
  echo "  --startedAt       Set startedAt to current timestamp"
  echo "  --completedAt     Set completedAt to current timestamp"
  echo "  --reviewedAt      Set reviewedAt to current timestamp"
  echo "  --reviewNotes=\"x\" Set reviewNotes field"
  echo "  --clearNotes      Remove reviewNotes field"
  exit 1
fi

TASK_ID="$1"
STATUS="$2"
shift 2

# Build optional field assignments
FIELD_SCRIPT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --startedAt)
      FIELD_SCRIPT="$FIELD_SCRIPT t.startedAt = new Date().toISOString();"
      ;;
    --completedAt)
      FIELD_SCRIPT="$FIELD_SCRIPT t.completedAt = new Date().toISOString();"
      ;;
    --reviewedAt)
      FIELD_SCRIPT="$FIELD_SCRIPT t.reviewedAt = new Date().toISOString();"
      ;;
    --reviewNotes=*)
      NOTES="${1#--reviewNotes=}"
      FIELD_SCRIPT="$FIELD_SCRIPT t.reviewNotes = $(node -e "process.stdout.write(JSON.stringify('$NOTES'))");"
      ;;
    --clearNotes)
      FIELD_SCRIPT="$FIELD_SCRIPT delete t.reviewNotes;"
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
  shift
done

node -e "
const fs = require('fs');
const f = '$TASKS_FILE';
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
const t = d.tasks.find(t => t.id === '$TASK_ID');
if (!t) { console.error('Task $TASK_ID not found'); process.exit(1); }
t.status = '$STATUS';
$FIELD_SCRIPT
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
console.log('Updated $TASK_ID -> $STATUS');
"
