export type PaginationStrategy = 'next-link' | 'url-pattern';

export type FieldRow = {
  id: string;
  name: string;
  selector: string;
  attribute: string;
};

export type FormState = {
  preset: string;
  url: string;
  container: string;
  item: string;
  fields: FieldRow[];
  output: string;
  paginate: boolean;
  strategy: PaginationStrategy;
  nextSelector: string;
  nextUrlSourceSelector: string;
  nextUrlAttribute: string;
  nextSiblingSelector: string;
  urlTemplate: string;
  maxPages: number;
  failOnPageError: boolean;
  retryAttempts: string;
  retryDelayMs: string;
  pageDelayMs: string;
};

export type StoredForm = Omit<FormState, 'fields'> & { fields: string };

export type ScrapeBody = {
  url: string;
  container: string;
  item: string;
  fields: string;
  output?: string;
  paginate: boolean;
  strategy: PaginationStrategy;
  nextSelector: string;
  nextUrlSourceSelector: string;
  nextUrlAttribute: string;
  nextSiblingSelector: string;
  urlTemplate: string;
  maxPages: number;
  failOnPageError: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
  pageDelayMs?: number;
};

export type ScrapeConfigFields = Partial<
  Omit<FormState, 'preset' | 'fields' | 'retryAttempts' | 'retryDelayMs' | 'pageDelayMs'>
> & {
  fields?: string;
  retryAttempts?: number | string;
  retryDelayMs?: number | string;
  pageDelayMs?: number | string;
  presetName?: string;
};

export type LoadedConfig = {
  defaults: ScrapeConfigFields;
  presets: Array<ScrapeConfigFields & { presetName: string }>;
};

export type HistoryStatus = 'done' | 'error' | 'cancelled' | 'zero';

export type HistoryEntry = {
  id: string;
  startedAt: number;
  finishedAt: number;
  url: string;
  presetName: string;
  status: HistoryStatus;
  count: number | null;
  csvPath: string | null;
};

export type LogKind = 'info' | 'success' | 'error' | 'warn' | 'page';

export type LogLine = {
  id: string;
  kind: LogKind;
  text: string;
  page?: number;
  count?: number;
};

export type JobPhase = 'idle' | 'starting' | 'running' | 'done' | 'error' | 'cancelled' | 'zero';

export type PreviewRow = Record<string, string | number | null | undefined>;

export type OutputFile = {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
};

export type OutputListResponse = {
  files: OutputFile[];
  totalBytes: number;
  limitBytes: number;
};

export type OutputPreview = {
  name: string;
  headers: string[];
  rows: PreviewRow[];
  truncated: boolean;
};

export type DialogMode = 'hidden' | 'open' | 'minimized';

export type SseEvent =
  | { type: 'start' }
  | { type: 'page'; page: number; count: number }
  | { type: 'warning'; warning?: { message?: string } }
  | { type: 'done'; count: number; preview?: PreviewRow[]; csvPath?: string | null }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };
