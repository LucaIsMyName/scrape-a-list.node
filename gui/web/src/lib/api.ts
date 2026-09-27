import type { LoadedConfig, OutputFile, OutputListResponse, OutputPreview, ScrapeBody, ScrapeConfigFields } from './types';

export async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchConfig(): Promise<LoadedConfig> {
  let response: Response;
  try {
    response = await fetch('/api/config');
  } catch {
    throw new Error('API is not reachable. Use `npm run gui:dev` so Express is on port 3000.');
  }
  const data = await readJsonResponse(response);
  if (data == null || !response.ok) {
    if (data == null || response.status >= 500) {
      throw new Error('API is not reachable. Use `npm run gui:dev` so Express is on port 3000.');
    }
    throw new Error((typeof data.error === 'string' && data.error) || 'Could not load presets from the server.');
  }
  return {
    defaults: (data.defaults as ScrapeConfigFields) || {},
    presets: Array.isArray(data.presets) ? (data.presets as LoadedConfig['presets']) : [],
  };
}

export function mergePresetLocally(config: LoadedConfig, presetName: string): ScrapeConfigFields {
  const defaults = config.defaults || {};
  if (!presetName) return { ...defaults };
  const selected = (config.presets || []).find((preset) => preset.presetName === presetName);
  if (!selected) {
    throw new Error(`Unknown preset "${presetName}".`);
  }
  const { presetName: _ignored, ...presetValues } = selected;
  return { ...defaults, ...presetValues };
}

export async function fetchPresetConfig(
  config: LoadedConfig,
  presetName: string,
): Promise<ScrapeConfigFields> {
  const params = new URLSearchParams({ name: presetName });
  const response = await fetch(`/api/preset?${params}`);
  const data = await readJsonResponse(response);
  if (data == null) {
    return mergePresetLocally(config, presetName);
  }
  if (!response.ok) {
    if (response.status === 404) {
      return mergePresetLocally(config, presetName);
    }
    throw new Error((typeof data.error === 'string' && data.error) || 'Could not load preset.');
  }
  return (data.config as ScrapeConfigFields) || {};
}

export async function startScrape(body: ScrapeBody): Promise<string> {
  const response = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((typeof data.error === 'string' && data.error) || 'Unknown error');
  }
  if (!data.jobId || typeof data.jobId !== 'string') {
    throw new Error('Server response missing jobId.');
  }
  return data.jobId;
}

export async function cancelScrape(jobId: string): Promise<{ ok: true } | { error: string; status: number }> {
  const response = await fetch(`/api/scrape/cancel/${encodeURIComponent(jobId)}`, {
    method: 'POST',
  });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => ({}));
  return {
    error: (typeof data.error === 'string' && data.error) || `Stop failed (HTTP ${response.status}).`,
    status: response.status,
  };
}

export async function listOutputFiles(): Promise<OutputListResponse> {
  const response = await fetch('/api/outputs');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((typeof data.error === 'string' && data.error) || 'Could not list output files.');
  }
  return {
    files: Array.isArray(data.files) ? (data.files as OutputFile[]) : [],
    totalBytes: Number(data.totalBytes) || 0,
    limitBytes: Number(data.limitBytes) || 0,
  };
}

export async function previewOutputFile(csvPath: string): Promise<OutputPreview> {
  const response = await fetch(`/api/outputs/preview?file=${encodeURIComponent(csvPath)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((typeof data.error === 'string' && data.error) || 'Could not preview CSV.');
  }
  return data as OutputPreview;
}

export async function deleteOutputFile(csvPath: string): Promise<void> {
  const response = await fetch('/api/outputs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: csvPath }),
  });
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  throw new Error((typeof data.error === 'string' && data.error) || 'Could not delete CSV.');
}

export function downloadUrl(csvPath: string): string {
  return `/api/download?file=${encodeURIComponent(csvPath)}`;
}

export async function downloadCsv(csvPath: string): Promise<void> {
  const url = downloadUrl(csvPath);
  const response = await fetch(url);
  if (response.status === 404) {
    throw new Error('CSV is no longer on the server.');
  }
  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = utfMatch
    ? decodeURIComponent(utfMatch[1])
    : plainMatch?.[1] || 'download.csv';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
