#!/usr/bin/env bash
set -euo pipefail

MAIN_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS_FILE="$MAIN_REPO/.ai/swarm/tasks.json"

if [ ! -f "$TASKS_FILE" ]; then
  echo "No active swarm (tasks.json not found)"
  exit 1
fi

node -e "
const data = JSON.parse(require('fs').readFileSync('$TASKS_FILE', 'utf8'));

const icons = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  review: '◎',
  merged: '✓',
  blocked: '✗'
};

console.log('=== Swarm Status ===');
console.log('ID:      ' + data.swarmId);
console.log('Created: ' + data.created);
console.log('Workers: ' + data.config.workerCount);
console.log('');

if (data.tasks.length === 0) {
  console.log('No tasks yet. Run the planner to populate tasks.');
  process.exit(0);
}

// Status counts
const counts = {};
data.tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
console.log('--- Summary ---');
Object.entries(counts).forEach(([s, c]) => {
  console.log('  ' + (icons[s] || '?') + ' ' + s + ': ' + c);
});
console.log('  Total: ' + data.tasks.length);
console.log('');

// Per-worker breakdown
const byWorker = {};
data.tasks.forEach(t => {
  const w = t.assignee || 'unassigned';
  if (!byWorker[w]) byWorker[w] = [];
  byWorker[w].push(t);
});

console.log('--- By Worker ---');
Object.entries(byWorker).sort().forEach(([worker, tasks]) => {
  console.log(worker + ':');
  tasks.forEach(t => {
    const icon = icons[t.status] || '?';
    const deps = t.dependsOn.length ? ' (depends: ' + t.dependsOn.join(', ') + ')' : '';
    console.log('  ' + icon + ' ' + t.id + ' [' + t.group + '] ' + t.title + deps);
  });
});
"
