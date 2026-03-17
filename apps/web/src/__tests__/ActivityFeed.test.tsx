// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityFeed from '../components/ActivityFeed';
import type { Activity } from '../types';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    activityId: 'act-1',
    userId: 'user-1',
    userEmail: 'alice@example.com',
    action: 'task.created',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ActivityFeed', () => {
  // ── Empty state ──

  it('shows empty message when no activities', () => {
    render(<ActivityFeed activities={[]} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  // ── Rendering items ──

  it('renders correct number of activity items', () => {
    const activities = [
      makeActivity({ activityId: 'a1', action: 'task.created' }),
      makeActivity({ activityId: 'a2', action: 'comment.created' }),
      makeActivity({ activityId: 'a3', action: 'task.updated', field: 'status', oldValue: 'todo', newValue: 'done' }),
    ];

    const { container } = render(<ActivityFeed activities={activities} />);
    // Each ActivityItem renders in a div with items-start class
    const items = container.querySelectorAll('.flex.items-start');
    expect(items).toHaveLength(3);
  });

  // ── Action descriptions ──

  it('displays "created this task" for task.created action', () => {
    const activities = [makeActivity({ action: 'task.created', userEmail: 'bob@test.com' })];
    render(<ActivityFeed activities={activities} />);
    expect(screen.getByText('bob created this task')).toBeInTheDocument();
  });

  it('displays field change for task.updated action', () => {
    const activities = [
      makeActivity({
        activityId: 'a1',
        action: 'task.updated',
        field: 'status',
        oldValue: 'todo',
        newValue: 'in_progress',
        userEmail: 'carol@test.com',
      }),
    ];
    render(<ActivityFeed activities={activities} />);
    expect(screen.getByText(/carol changed status from/)).toBeInTheDocument();
  });

  it('displays "added a comment" for comment.created action', () => {
    const activities = [makeActivity({ action: 'comment.created', userEmail: 'dave@test.com' })];
    render(<ActivityFeed activities={activities} />);
    expect(screen.getByText('dave added a comment')).toBeInTheDocument();
  });

  // ── User avatar ──

  it('renders first letter of user email as avatar', () => {
    const activities = [makeActivity({ userEmail: 'zara@test.com' })];
    render(<ActivityFeed activities={activities} />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  // ── className prop ──

  it('applies custom className', () => {
    const activities = [makeActivity()];
    const { container } = render(<ActivityFeed activities={activities} className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });
});
