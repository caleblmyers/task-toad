import { describe, it, expect } from 'vitest';
import {
  buildTaskPlanPrompt,
  buildProjectOptionsPrompt,
  userInput,
  buildSummarizeProjectPrompt,
  buildExpandTaskPrompt,
} from '../promptBuilder.js';

describe('userInput', () => {
  it('wraps value with user_input tags', () => {
    const result = userInput('title', 'My Project');
    expect(result).toBe('<user_input label="title">My Project</user_input>');
  });

  it('escapes label with JSON.stringify', () => {
    const result = userInput('my "label"', 'value');
    expect(result).toContain('label="my \\"label\\""');
  });
});

describe('buildProjectOptionsPrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildProjectOptionsPrompt('Build a todo app');
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('mentions exactly 3 distinct project interpretations', () => {
    const result = buildProjectOptionsPrompt('Build a todo app');
    expect(result.userPrompt).toContain('exactly 3 distinct project interpretations');
  });

  it('wraps user prompt in user_input tags', () => {
    const result = buildProjectOptionsPrompt('My app idea');
    expect(result.userPrompt).toContain('<user_input label="prompt">My app idea</user_input>');
  });
});

describe('buildTaskPlanPrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildTaskPlanPrompt('My Project', 'A cool project', 'Build it');
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('contains the task count cap in systemPrompt', () => {
    const result = buildTaskPlanPrompt('My Project', 'desc', 'prompt');
    expect(result.systemPrompt).toContain('5–10 tasks');
    expect(result.systemPrompt).toContain('NEVER more than 10');
  });

  it('wraps project title in user_input tags', () => {
    const result = buildTaskPlanPrompt('TaskToad', 'desc', 'prompt');
    expect(result.userPrompt).toContain('<user_input label="title">TaskToad</user_input>');
  });

  it('truncates long descriptions to 400 chars', () => {
    const longDesc = 'x'.repeat(500);
    const result = buildTaskPlanPrompt('Proj', longDesc, 'prompt');
    // The truncated version ends with … and is 400 chars total
    expect(result.userPrompt).not.toContain(longDesc);
    // Should contain the truncated version (399 chars + ellipsis)
    expect(result.userPrompt).toContain('…');
  });

  it('includes context when provided', () => {
    const result = buildTaskPlanPrompt('P', 'D', 'Q', 'extra context');
    expect(result.userPrompt).toContain('Additional context');
    expect(result.userPrompt).toContain('extra context');
  });

  it('includes knowledge base when provided', () => {
    const result = buildTaskPlanPrompt('P', 'D', 'Q', null, 'kb content');
    expect(result.userPrompt).toContain('Knowledge Base');
    expect(result.userPrompt).toContain('kb content');
  });

  it('includes dedup warning for existing task titles', () => {
    const result = buildTaskPlanPrompt('P', 'D', 'Q', null, null, ['Task A', 'Task B']);
    expect(result.userPrompt).toContain('Do NOT create tasks');
    expect(result.userPrompt).toContain('Task A');
  });
});

describe('buildExpandTaskPrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildExpandTaskPrompt('Task', 'Desc', 'Project');
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('wraps task title in user_input tags', () => {
    const result = buildExpandTaskPrompt('My Task', 'Desc', 'Proj');
    expect(result.userPrompt).toContain('<user_input label="title">My Task</user_input>');
  });
});

describe('buildSummarizeProjectPrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildSummarizeProjectPrompt('Proj', 'Desc', []);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('includes task count', () => {
    const tasks = [
      { title: 'T1', status: 'done' },
      { title: 'T2', status: 'todo' },
    ];
    const result = buildSummarizeProjectPrompt('Proj', 'Desc', tasks);
    expect(result.userPrompt).toContain('2 total');
  });

  it('groups tasks by status', () => {
    const tasks = [
      { title: 'Done task', status: 'done' },
      { title: 'In progress', status: 'in_progress' },
      { title: 'Todo task', status: 'todo' },
    ];
    const result = buildSummarizeProjectPrompt('Proj', 'Desc', tasks);
    expect(result.userPrompt).toContain('Done (1)');
    expect(result.userPrompt).toContain('In Progress (1)');
    expect(result.userPrompt).toContain('To Do (1)');
  });
});
