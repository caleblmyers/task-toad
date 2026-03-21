/**
 * Task Query Language (TQL) Parser
 *
 * Parses text queries like `status:done priority:high assignee:john` into
 * FilterGroupInput objects for the tasks query.
 *
 * Supported syntax:
 * - Field filters: status:done, priority:high
 * - Negation: -status:done or NOT status:done
 * - Multiple values: status:done,in_progress
 * - Comparison: storyPoints>5, estimatedHours<=8, dueDate<2026-04-01
 * - Text search: bare words (e.g., fix login bug)
 * - Grouping: (status:done OR status:in_review) AND priority:high
 * - Quoting: assignee:"John Smith"
 */

export interface FilterConditionInput {
  field: string;
  op: string;
  value: string;
}

export interface FilterGroupInput {
  operator: 'AND' | 'OR';
  conditions?: FilterConditionInput[];
  groups?: FilterGroupInput[];
}

export class TQLParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
    public readonly query: string,
  ) {
    super(`TQL parse error at position ${position}: ${message}`);
    this.name = 'TQLParseError';
  }
}

const VALID_FIELDS = new Set([
  'status', 'priority', 'assignee', 'label', 'taskType',
  'dueDate', 'estimatedHours', 'storyPoints', 'sprintId', 'search',
]);

const COMPARISON_OPS: Record<string, string> = {
  '>=': 'gte',
  '<=': 'lte',
  '>': 'gt',
  '<': 'lt',
};

class TQLTokenizer {
  private pos = 0;

  constructor(private readonly input: string) {}

  get position(): number {
    return this.pos;
  }

  get remaining(): string {
    return this.input.slice(this.pos);
  }

  get done(): boolean {
    return this.pos >= this.input.length;
  }

  skipWhitespace(): void {
    while (this.pos < this.input.length && this.input[this.pos] === ' ') {
      this.pos++;
    }
  }

  peek(): string {
    return this.input[this.pos] ?? '';
  }

  consume(expected: string): void {
    if (this.input[this.pos] !== expected) {
      throw new TQLParseError(`Expected '${expected}', got '${this.input[this.pos] ?? 'end of input'}'`, this.pos, this.input);
    }
    this.pos++;
  }

  /** Read a quoted string (opening quote already peeked) */
  readQuoted(): string {
    this.consume('"');
    let result = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.pos++;
        result += this.input[this.pos];
      } else {
        result += this.input[this.pos];
      }
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      throw new TQLParseError('Unterminated quoted string', this.pos, this.input);
    }
    this.consume('"');
    return result;
  }

  /** Read a bare word (stops at whitespace, parens, colon, quotes) */
  readWord(): string {
    const start = this.pos;
    while (this.pos < this.input.length && !/[\s():"']/.test(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  /** Read a value (can be quoted or bare, supports comma-separated) */
  readValue(): string {
    if (this.peek() === '"') {
      return this.readQuoted();
    }
    const start = this.pos;
    while (this.pos < this.input.length && !/[\s()]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }
}

/**
 * Parse a TQL query string into a FilterGroupInput.
 */
export function parseTQL(query: string): FilterGroupInput {
  const trimmed = query.trim();
  if (!trimmed) {
    return { operator: 'AND' };
  }

  const tokenizer = new TQLTokenizer(trimmed);
  const result = parseExpression(tokenizer);
  tokenizer.skipWhitespace();
  if (!tokenizer.done) {
    throw new TQLParseError(`Unexpected input: '${tokenizer.remaining.slice(0, 20)}'`, tokenizer.position, trimmed);
  }
  return result;
}

function parseExpression(tokenizer: TQLTokenizer): FilterGroupInput {
  // Parse a sequence of terms possibly connected by AND/OR
  const first = parseTerm(tokenizer);
  tokenizer.skipWhitespace();

  // Check if there's an explicit OR
  if (matchKeyword(tokenizer, 'OR')) {
    tokenizer.skipWhitespace();
    const right = parseExpression(tokenizer);
    return mergeGroups('OR', first, right);
  }

  // Check for explicit AND
  if (matchKeyword(tokenizer, 'AND')) {
    tokenizer.skipWhitespace();
    const right = parseExpression(tokenizer);
    return mergeGroups('AND', first, right);
  }

  // Implicit AND — if there's more input that's not a closing paren
  if (!tokenizer.done && tokenizer.peek() !== ')') {
    const right = parseExpression(tokenizer);
    return mergeGroups('AND', first, right);
  }

  return first;
}

function matchKeyword(tokenizer: TQLTokenizer, keyword: string): boolean {
  const remaining = tokenizer.remaining;
  if (remaining.startsWith(keyword) && (remaining.length === keyword.length || remaining[keyword.length] === ' ' || remaining[keyword.length] === '(')) {
    // Advance past the keyword
    for (let i = 0; i < keyword.length; i++) {
      tokenizer.consume(keyword[i]);
    }
    return true;
  }
  return false;
}

function parseTerm(tokenizer: TQLTokenizer): FilterGroupInput {
  tokenizer.skipWhitespace();

  // Parenthesized group
  if (tokenizer.peek() === '(') {
    tokenizer.consume('(');
    const inner = parseExpression(tokenizer);
    tokenizer.skipWhitespace();
    tokenizer.consume(')');
    return inner;
  }

  // Negation: -field:value or NOT field:value
  const negated = checkNegation(tokenizer);

  // Read the first word
  const startPos = tokenizer.position;
  const word = tokenizer.readWord();

  if (!word) {
    throw new TQLParseError('Expected a field name or search term', startPos, '');
  }

  // Check for comparison operators in the word (e.g., storyPoints>5)
  for (const [opStr, opName] of Object.entries(COMPARISON_OPS)) {
    const idx = word.indexOf(opStr);
    if (idx > 0) {
      const field = word.slice(0, idx);
      const value = word.slice(idx + opStr.length);
      validateField(field, startPos);
      return makeConditionGroup(field, negated ? negateOp(opName) : opName, value);
    }
  }

  // Check for field:value
  if (tokenizer.peek() === ':') {
    const field = word;
    validateField(field, startPos);
    tokenizer.consume(':');
    const value = tokenizer.readValue();

    // Check for comma-separated values (multi-value)
    if (value.includes(',')) {
      const op = negated ? 'not_in' : 'in';
      return makeConditionGroup(field, op, value);
    }

    const op = negated ? 'neq' : 'eq';
    return makeConditionGroup(field, op, value);
  }

  // Bare word — treat as text search. Collect consecutive bare words.
  let searchText = word;
  tokenizer.skipWhitespace();

  // Keep collecting bare words that aren't keywords or field:value patterns
  while (!tokenizer.done && tokenizer.peek() !== ')') {
    const savedPos = tokenizer.position;
    const remaining = tokenizer.remaining;

    // Stop if we hit AND/OR keywords
    if (/^(AND|OR)\s/.test(remaining) || /^(AND|OR)$/.test(remaining)) {
      break;
    }

    // Stop if we hit a negation prefix followed by a field
    if (remaining.startsWith('-') || /^NOT\s/.test(remaining)) {
      break;
    }

    // Peek ahead — if next word contains : or comparison op, stop
    const nextWord = peekWord(remaining);
    if (!nextWord) break;
    if (nextWord.includes(':') || /[><=]/.test(nextWord)) {
      break;
    }

    // Check if the word after this one has a colon (field:value pattern)
    const afterWord = remaining.slice(nextWord.length).trimStart();
    if (afterWord.startsWith(':')) {
      // This word is a field name — stop collecting search text
      break;
    }

    // It's a bare search word — consume it
    const w = tokenizer.readWord();
    if (!w) {
      // Restore position and break
      break;
    }
    searchText += ' ' + w;
    tokenizer.skipWhitespace();

    // Safety: if we didn't advance, break
    if (tokenizer.position === savedPos) break;
  }

  return makeConditionGroup('search', 'contains', searchText);
}

function peekWord(str: string): string {
  const match = str.match(/^[^\s():,"><=]+/);
  return match ? match[0] : '';
}

function checkNegation(tokenizer: TQLTokenizer): boolean {
  if (tokenizer.peek() === '-') {
    tokenizer.consume('-');
    return true;
  }
  if (matchKeyword(tokenizer, 'NOT')) {
    tokenizer.skipWhitespace();
    return true;
  }
  return false;
}

function negateOp(op: string): string {
  switch (op) {
    case 'gt': return 'lte';
    case 'lt': return 'gte';
    case 'gte': return 'lt';
    case 'lte': return 'gt';
    case 'eq': return 'neq';
    case 'neq': return 'eq';
    default: return op;
  }
}

function validateField(field: string, position: number): void {
  if (!VALID_FIELDS.has(field)) {
    throw new TQLParseError(`Unknown field '${field}'. Valid fields: ${[...VALID_FIELDS].join(', ')}`, position, '');
  }
}

function makeConditionGroup(field: string, op: string, value: string): FilterGroupInput {
  return {
    operator: 'AND',
    conditions: [{ field, op, value }],
  };
}

function mergeGroups(operator: 'AND' | 'OR', left: FilterGroupInput, right: FilterGroupInput): FilterGroupInput {
  // If both are the same operator, flatten
  if (left.operator === operator && right.operator === operator) {
    return {
      operator,
      conditions: [...(left.conditions ?? []), ...(right.conditions ?? [])],
      groups: [...(left.groups ?? []), ...(right.groups ?? [])],
    };
  }

  // If left matches the operator, append right as a sub-group
  if (left.operator === operator) {
    return {
      operator,
      conditions: left.conditions,
      groups: [...(left.groups ?? []), right],
    };
  }

  // If right matches, prepend left as a sub-group
  if (right.operator === operator) {
    return {
      operator,
      conditions: right.conditions,
      groups: [left, ...(right.groups ?? [])],
    };
  }

  // Neither matches — wrap both as sub-groups
  return {
    operator,
    groups: [left, right],
  };
}
