import { parseFieldsSafe, serializeFields } from './fields';
import { normalizeOutputForForm, suggestedOutputName } from './validation';
import type { FormState, HistoryEntry, ScrapeConfigFields, StoredForm } from './types';

export const FORM_STORAGE_KEY = 'scrape-a-list-form-v1';
export const THEME_STORAGE_KEY = 'scrape-a-list-theme';
export const HISTORY_STORAGE_KEY = 'scrape-a-list-history-v1';
export const HISTORY_MAX = 20;

export function emptyForm(): FormState {
  return {
    preset: '',
    url: '',
    container: '',
    item: '',
    fields: parseFieldsSafe(''),
    output: suggestedOutputName(),
    paginate: false,
    strategy: 'next-link',
    nextSelector: '',
    nextUrlSourceSelector: '',
    nextUrlAttribute: '',
    nextSiblingSelector: '',
    urlTemplate: '',
    maxPages: 0,
    failOnPageError: false,
    retryAttempts: '',
    retryDelayMs: '',
    pageDelayMs: '',
  };
}

function optionalNumberAsString(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value);
}

export function configToForm(src: ScrapeConfigFields | StoredForm, preset = ''): FormState {
  return {
    preset,
    url: src.url || '',
    container: src.container || '',
    item: src.item || '',
    fields: parseFieldsSafe(typeof src.fields === 'string' ? src.fields : ''),
    output: normalizeOutputForForm(src.output) || suggestedOutputName(preset),
    paginate: Boolean(src.paginate),
    strategy: src.strategy === 'url-pattern' ? 'url-pattern' : 'next-link',
    nextSelector: src.nextSelector || '',
    nextUrlSourceSelector: src.nextUrlSourceSelector || '',
    nextUrlAttribute: src.nextUrlAttribute || '',
    nextSiblingSelector: src.nextSiblingSelector || '',
    urlTemplate: src.urlTemplate || '',
    maxPages: src.maxPages != null ? Number(src.maxPages) || 0 : 0,
    failOnPageError: Boolean(src.failOnPageError),
    retryAttempts: optionalNumberAsString(src.retryAttempts),
    retryDelayMs: optionalNumberAsString(src.retryDelayMs),
    pageDelayMs: optionalNumberAsString(src.pageDelayMs),
  };
}

export function formToStored(form: FormState): StoredForm {
  return {
    ...form,
    fields: serializeFields(form.fields),
  };
}

export function hasAdvancedValues(form: FormState): boolean {
  return Boolean(
    form.retryAttempts || form.retryDelayMs || form.pageDelayMs || form.failOnPageError,
  );
}

export function loadStoredForm(): FormState | null {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredForm;
    return configToForm(data, data.preset || '');
  } catch {
    return null;
  }
}

export function saveStoredForm(form: FormState): void {
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formToStored(form)));
  } catch {
    /* ignore quota errors */
  }
}

export function loadTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function prependHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.id !== entry.id)].slice(
    0,
    HISTORY_MAX,
  );
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  return next;
}
