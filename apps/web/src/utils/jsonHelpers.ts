const DEFAULT_COLUMNS = ['todo', 'in_progress', 'done'];

export function parseColumns(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_COLUMNS;
  try { return JSON.parse(raw) as string[]; } catch { return DEFAULT_COLUMNS; }
}

export function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function parseStatuses(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_COLUMNS;
  try { return JSON.parse(raw) as string[]; } catch { return DEFAULT_COLUMNS; }
}
