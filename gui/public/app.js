/** @typedef {'info'|'success'|'error'|'warn'|'page'} LogKind */

const LOG_LINE_CLASS = {
  info: 'whitespace-pre text-muted',
  success: 'whitespace-pre text-success',
  error: 'whitespace-pre text-error',
  warn: 'whitespace-pre text-warn font-semibold',
  page: 'whitespace-pre text-log',
};

const DOT_RUNNING = 'h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse';
const DOT_DONE = 'h-2 w-2 shrink-0 rounded-full bg-success';
const DOT_ERROR = 'h-2 w-2 shrink-0 rounded-full bg-error';
const DOT_CANCELLED = 'h-2 w-2 shrink-0 rounded-full bg-warn';

const STORAGE_KEY = 'scrape-a-list-form-v1';
const THEME_STORAGE_KEY = 'scrape-a-list-theme';
const AUTO_OUTPUT_RE = /^list-\d{14}\.csv$/;

function getTheme() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  updateThemeToggleUI(next);
}

function updateThemeToggleUI(theme) {
  const btn = $('theme-toggle');
  if (!btn) return;
  const isDark = theme === 'dark';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function $(id) {
  return document.getElementById(id);
}

function updatePaginationUI(on) {
  $('pagination-opts').classList.toggle('hidden', !on);
  if (on) updateStrategyUI($('strategy').value);
}

function updateStrategyUI(val) {
  $('pane-next-link').classList.toggle('hidden', val !== 'next-link');
  $('pane-url-pattern').classList.toggle('hidden', val !== 'url-pattern');
}

function updateAdvancedUI(open) {
  $('advanced-panel').classList.toggle('hidden', !open);
  $('advanced-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}

const overlay = $('dialog-overlay');
const dialog = $('dialog');
const dialogDot = $('dialog-dot');
const dialogTitle = $('dialog-title-text');
const dialogStats = $('dialog-stats');
const logEl = $('log');
const dialogResult = $('dialog-result');
const closeBtnEl = $('dialog-close-btn');
const minBtnEl = $('dialog-minimize-btn');
const abortBtnEl = $('dialog-abort-btn');
const pill = $('dialog-pill');
const pillDot = $('pill-dot');
const pillLabel = $('pill-label');
const scrapeBtn = $('scrape-btn');
const btnLabel = $('scrape-btn-label');

let lastCsvPath = null;
let scraping = false;
let activeJobId = null;
let streamClosedReason = null;
let totalItemsSoFar = 0;
let formDirty = false;
let loadedConfig = { defaults: {}, presets: [] };
let lastFocusedBeforeDialog = null;

function setAbortVisible(show) {
  abortBtnEl.classList.toggle('hidden', !show);
  abortBtnEl.classList.toggle('inline-flex', show);
}

function openDialog() {
  lastFocusedBeforeDialog = document.activeElement;
  overlay.classList.remove('hidden');
  dialog.classList.remove('hidden');
  dialog.classList.add('flex');
  pill.classList.add('hidden');
  pill.classList.remove('flex');
  dialog.setAttribute('aria-busy', 'true');
  minBtnEl.focus();
}

function minimizeDialog() {
  overlay.classList.add('hidden');
  dialog.classList.add('hidden');
  dialog.classList.remove('flex');
  pill.classList.remove('hidden');
  pill.classList.add('flex');
}

function closeDialog() {
  overlay.classList.add('hidden');
  dialog.classList.add('hidden');
  dialog.classList.remove('flex');
  pill.classList.add('hidden');
  pill.classList.remove('flex');
  dialog.removeAttribute('aria-busy');
  if (lastFocusedBeforeDialog && typeof lastFocusedBeforeDialog.focus === 'function') {
    lastFocusedBeforeDialog.focus();
  }
}

function restoreDialog() {
  pill.classList.add('hidden');
  pill.classList.remove('flex');
  overlay.classList.remove('hidden');
  dialog.classList.remove('hidden');
  dialog.classList.add('flex');
}

function resetDialog() {
  logEl.replaceChildren();
  dialogResult.classList.add('hidden');
  dialogResult.classList.remove('flex');
  $('preview-head').replaceChildren();
  $('preview-body').replaceChildren();
  $('table-note').textContent = '';
  dialogDot.className = DOT_RUNNING;
  dialogTitle.textContent = 'Scraping…';
  dialogStats.textContent = '';
  dialogStats.classList.add('hidden');
  closeBtnEl.disabled = true;
  lastCsvPath = null;
  streamClosedReason = null;
  totalItemsSoFar = 0;
  setAbortVisible(false);
  activeJobId = null;
}

function appendLog(text, cls = 'info') {
  const line = document.createElement('div');
  line.className = LOG_LINE_CLASS[cls] || LOG_LINE_CLASS.info;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function appendPageLog(page, count) {
  totalItemsSoFar += count;
  dialogStats.textContent = `Page ${page} · ${totalItemsSoFar} item${totalItemsSoFar !== 1 ? 's' : ''} total`;
  dialogStats.classList.remove('hidden');

  const line = document.createElement('div');
  line.className = LOG_LINE_CLASS.page;
  const prefix = document.createTextNode('  Page ');
  const pageEl = document.createElement('span');
  pageEl.className = 'text-accent';
  pageEl.textContent = String(page);
  const mid = document.createTextNode(': ');
  const countEl = document.createElement('span');
  countEl.className = 'text-text';
  countEl.textContent = String(count);
  const suffix = document.createTextNode(` item${count !== 1 ? 's' : ''}`);
  line.append(prefix, pageEl, mid, countEl, suffix);
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function markDone(success) {
  dialogDot.className = success ? DOT_DONE : DOT_ERROR;
  scraping = false;
  closeBtnEl.disabled = false;
  dialog.removeAttribute('aria-busy');
}

function markCancelled() {
  dialogDot.className = DOT_CANCELLED;
  scraping = false;
  closeBtnEl.disabled = false;
  dialog.removeAttribute('aria-busy');
}

function setScrapeButtonLoading(loading) {
  scrapeBtn.disabled = loading;
  $('scrape-btn-spinner').classList.toggle('hidden', !loading);
  btnLabel.textContent = loading ? 'Scraping…' : 'Scrape';
}

function showInlineError(msg) {
  const el = $('inline-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearInlineError() {
  const el = $('inline-error');
  el.classList.add('hidden');
  el.textContent = '';
}

function showConfigBanner(msg) {
  const el = $('config-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideConfigBanner() {
  $('config-banner').classList.add('hidden');
}

function isAutoGeneratedOutput(value) {
  const v = String(value || '').trim();
  return v === '' || AUTO_OUTPUT_RE.test(v);
}

function normalizeOutputForForm(value) {
  return isAutoGeneratedOutput(value) ? '' : String(value || '').trim();
}

function validateFieldsClient(fieldsRaw) {
  const pairs = fieldsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pairs.length) return 'At least one field is required.';
  const names = new Set();
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) {
      return `Invalid field "${pair}". Expected "name:selector".`;
    }
    const name = pair.slice(0, colonIdx).trim();
    let selector = pair.slice(colonIdx + 1).trim();
    const attrMatch = selector.match(/^(.+)@([A-Za-z][\w-]*)$/);
    if (attrMatch) {
      selector = attrMatch[1].trim();
      if (!selector) {
        return `Invalid field "${pair}". Selector is required before @attribute.`;
      }
    } else if (selector.includes('@')) {
      return `Invalid field "${pair}". Attribute after @ must start with a letter.`;
    }
    if (!name || !selector) {
      return `Invalid field "${pair}". Both name and selector are required.`;
    }
    if (names.has(name)) {
      return `Duplicate field name "${name}".`;
    }
    names.add(name);
  }
  return null;
}

function validateUrlClient(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'Please enter a valid URL.';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'URL must use http or https.';
  }
  return null;
}

function readFormBody() {
  const paginate = $('paginate-toggle').checked;
  const retryRaw = $('retry-attempts').value.trim();
  const retryDelayRaw = $('retry-delay-ms').value.trim();
  const pageDelayRaw = $('page-delay-ms').value.trim();
  const body = {
    url: $('url').value.trim(),
    container: $('container').value.trim(),
    item: $('item').value.trim(),
    fields: $('fields').value.trim(),
    output: $('output').value.trim(),
    paginate,
    strategy: $('strategy').value,
    nextSelector: $('next-selector').value.trim(),
    nextUrlSourceSelector: $('next-url-source-selector').value.trim(),
    nextUrlAttribute: $('next-url-attribute').value.trim(),
    nextSiblingSelector: $('next-sibling-selector').value.trim(),
    urlTemplate: $('url-template').value.trim(),
    maxPages: Number($('max-pages').value) || 0,
    failOnPageError: $('fail-on-page-error').checked,
  };
  if (retryRaw !== '') body.retryAttempts = Number(retryRaw);
  if (retryDelayRaw !== '') body.retryDelayMs = Number(retryDelayRaw);
  if (pageDelayRaw !== '') body.pageDelayMs = Number(pageDelayRaw);
  return body;
}

function saveFormToStorage() {
  try {
    const data = readFormBody();
    data.preset = $('preset').value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

let saveTimer = null;
function scheduleSaveForm() {
  formDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveFormToStorage, 400);
}

function restoreFormFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.preset) $('preset').value = data.preset;
    applyConfigToForm({}, { fromStorage: data });
    return true;
  } catch {
    return false;
  }
}

function renderResult(count, preview, csvPath) {
  lastCsvPath = csvPath;
  $('result-badge').textContent = `✓ ${count} item${count !== 1 ? 's' : ''} scraped`;

  const head = $('preview-head');
  const body = $('preview-body');
  if (preview && preview.length) {
    const cols = Object.keys(preview[0]);
    const tr = document.createElement('tr');
    cols.forEach((c) => {
      const th = document.createElement('th');
      th.className =
        'sticky top-0 bg-surface px-3 py-2 text-left text-xs font-semibold text-muted border-b border-border whitespace-nowrap';
      th.textContent = c;
      tr.appendChild(th);
    });
    head.appendChild(tr);

    preview.forEach((row, i) => {
      const tr = document.createElement('tr');
      if (i % 2 === 1) tr.className = 'bg-[var(--color-row-alt)]';
      cols.forEach((c) => {
        const td = document.createElement('td');
        td.className =
          'max-w-[220px] truncate border-b border-border px-3 py-2 text-xs text-text';
        td.textContent = row[c] ?? '';
        td.title = row[c] ?? '';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  $('table-note').textContent =
    count > 20 ? `Showing first 20 of ${count} rows. Download for the full CSV.` : '';

  dialogResult.classList.remove('hidden');
  dialogResult.classList.add('flex');
}

function applyConfigToForm(d, options = {}) {
  const fromStorage = options.fromStorage || null;
  const src = fromStorage || d;
  $('url').value = src.url || '';
  $('container').value = src.container || '';
  $('item').value = src.item || '';
  $('fields').value = src.fields || '';
  $('output').value = normalizeOutputForForm(src.output);
  $('paginate-toggle').checked = Boolean(src.paginate);
  updatePaginationUI(Boolean(src.paginate));
  const strategy = src.strategy || 'next-link';
  $('strategy').value = strategy;
  updateStrategyUI(strategy);
  $('next-selector').value = src.nextSelector || '';
  $('next-url-source-selector').value = src.nextUrlSourceSelector || '';
  $('next-url-attribute').value = src.nextUrlAttribute || '';
  $('next-sibling-selector').value = src.nextSiblingSelector || '';
  $('url-template').value = src.urlTemplate || '';
  $('max-pages').value = src.maxPages != null ? src.maxPages : 0;
  $('retry-attempts').value =
    src.retryAttempts != null && src.retryAttempts !== '' ? String(src.retryAttempts) : '';
  $('retry-delay-ms').value =
    src.retryDelayMs != null && src.retryDelayMs !== '' ? String(src.retryDelayMs) : '';
  $('page-delay-ms').value =
    src.pageDelayMs != null && src.pageDelayMs !== '' ? String(src.pageDelayMs) : '';
  $('fail-on-page-error').checked = Boolean(src.failOnPageError);
  const hasAdvanced =
    $('retry-attempts').value ||
    $('retry-delay-ms').value ||
    $('page-delay-ms').value ||
    src.failOnPageError;
  updateAdvancedUI(Boolean(hasAdvanced));
}

function mergePresetLocally(presetName) {
  const defaults = loadedConfig.defaults || {};
  if (!presetName) return { ...defaults };
  const selected = (loadedConfig.presets || []).find((p) => p.presetName === presetName);
  if (!selected) {
    throw new Error(`Unknown preset "${presetName}".`);
  }
  const { presetName: _ignored, ...presetValues } = selected;
  return { ...defaults, ...presetValues };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchPresetConfig(presetName) {
  const params = new URLSearchParams({ name: presetName });
  const r = await fetch(`/api/preset?${params}`);
  const data = await readJsonResponse(r);
  if (data == null) {
    return mergePresetLocally(presetName);
  }
  if (!r.ok) {
    if (r.status === 404) {
      return mergePresetLocally(presetName);
    }
    throw new Error(data.error || 'Could not load preset.');
  }
  return data.config;
}

async function applyPresetToForm(presetName) {
  const config = presetName
    ? await fetchPresetConfig(presetName)
    : { ...(loadedConfig.defaults || {}) };
  applyConfigToForm(config);
}

function populatePresetOptions() {
  const presetEl = $('preset');
  presetEl.replaceChildren();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Global defaults';
  presetEl.appendChild(defaultOption);
  for (const preset of loadedConfig.presets || []) {
    const option = document.createElement('option');
    option.value = preset.presetName;
    option.textContent = preset.presetName;
    presetEl.appendChild(option);
  }
}

async function loadDefaults() {
  try {
    const r = await fetch('/api/config');
    const config = await readJsonResponse(r);
    if (config == null || !r.ok) {
      showConfigBanner(
        (config && config.error) || 'Could not load presets from the server.',
      );
      return;
    }
    hideConfigBanner();
    loadedConfig = {
      defaults: config?.defaults || {},
      presets: Array.isArray(config?.presets) ? config.presets : [],
    };
    populatePresetOptions();
    const restored = restoreFormFromStorage();
    if (!restored) {
      applyConfigToForm(loadedConfig.defaults || {});
    }
  } catch {
    showConfigBanner('Could not load presets. Check that the server is running.');
  }
}

function finishStream(reason) {
  streamClosedReason = reason;
}

function handleScrapeEndCleanup(btn) {
  setAbortVisible(false);
  activeJobId = null;
  setScrapeButtonLoading(false);
  scraping = false;
}

document.getElementById('paginate-toggle').addEventListener('change', (e) => {
  updatePaginationUI(e.target.checked);
  scheduleSaveForm();
});
document.getElementById('strategy').addEventListener('change', (e) => {
  updateStrategyUI(e.target.value);
  scheduleSaveForm();
});

$('advanced-toggle').addEventListener('click', () => {
  const open = $('advanced-panel').classList.contains('hidden');
  updateAdvancedUI(open);
});

minBtnEl.addEventListener('click', minimizeDialog);

abortBtnEl.addEventListener('click', async () => {
  if (!activeJobId) return;
  try {
    const res = await fetch(`/api/scrape/cancel/${encodeURIComponent(activeJobId)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      appendLog(data.error || `Stop failed (HTTP ${res.status}).`, 'error');
      if (res.status === 409) setAbortVisible(false);
    }
  } catch (err) {
    appendLog(`Stop failed: ${err.message}`, 'error');
  }
});

closeBtnEl.addEventListener('click', () => {
  if (!scraping) closeDialog();
});

pill.addEventListener('click', restoreDialog);
pill.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    restoreDialog();
  }
});

overlay.addEventListener('click', () => {
  if (!scraping) closeDialog();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (dialog.classList.contains('hidden')) return;
  if (scraping) {
    minimizeDialog();
    return;
  }
  closeDialog();
});

$('download-btn').addEventListener('click', () => {
  if (lastCsvPath) {
    window.location.href = `/api/download?file=${encodeURIComponent(lastCsvPath)}`;
  }
});

for (const id of [
  'url',
  'container',
  'item',
  'fields',
  'output',
  'next-selector',
  'next-url-source-selector',
  'next-url-attribute',
  'next-sibling-selector',
  'url-template',
  'max-pages',
  'retry-attempts',
  'retry-delay-ms',
  'page-delay-ms',
]) {
  $(id).addEventListener('input', scheduleSaveForm);
}
$('fail-on-page-error').addEventListener('change', scheduleSaveForm);

$('preset').addEventListener('change', async (e) => {
  if (formDirty && !window.confirm('Replace your edits with this preset?')) {
    e.target.value = e.target.dataset.lastValue || '';
    return;
  }
  e.target.dataset.lastValue = e.target.value;
  formDirty = false;
  try {
    await applyPresetToForm(e.target.value);
    hideConfigBanner();
    saveFormToStorage();
  } catch (err) {
    showConfigBanner(err.message);
  }
});

scrapeBtn.addEventListener('click', async () => {
  clearInlineError();

  const body = readFormBody();
  const paginate = body.paginate;
  const strategy = body.strategy;

  if (!body.url) return showInlineError('Please enter a starting page URL.');
  const urlErr = validateUrlClient(body.url);
  if (urlErr) return showInlineError(urlErr);
  if (!body.container) return showInlineError('Container selector is required.');
  if (!body.item) return showInlineError('Item selector is required.');
  const fieldsErr = validateFieldsClient(body.fields);
  if (fieldsErr) return showInlineError(fieldsErr);
  if (paginate && strategy !== 'next-link' && strategy !== 'url-pattern') {
    return showInlineError('Choose a pagination strategy.');
  }
  if (paginate && strategy === 'next-link' && !body.nextSelector) {
    return showInlineError('"Next page" selector is required.');
  }
  if (paginate && strategy === 'url-pattern' && !body.urlTemplate.includes('{page}')) {
    return showInlineError('URL template must contain {page}.');
  }
  if (
    body.retryAttempts != null &&
    (!Number.isInteger(body.retryAttempts) || body.retryAttempts < 0)
  ) {
    return showInlineError('Retries must be a non-negative integer.');
  }
  if (
    body.retryDelayMs != null &&
    (!Number.isInteger(body.retryDelayMs) || body.retryDelayMs < 0)
  ) {
    return showInlineError('Retry delay must be a non-negative integer.');
  }
  if (
    body.pageDelayMs != null &&
    (!Number.isInteger(body.pageDelayMs) || body.pageDelayMs < 0)
  ) {
    return showInlineError('Page delay must be a non-negative integer.');
  }

  if (!body.output) delete body.output;

  resetDialog();
  openDialog();
  scraping = true;
  setScrapeButtonLoading(true);

  pillLabel.textContent = 'Scraping in progress…';
  pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-accent';

  let jobId;
  try {
    const postRes = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await postRes.json();

    if (!postRes.ok) {
      appendLog('Error: ' + (data.error || 'Unknown error'), 'error');
      dialogTitle.textContent = 'Error';
      markDone(false);
      pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-error';
      pillLabel.textContent = 'Error — click to view';
      handleScrapeEndCleanup(scrapeBtn);
      return;
    }

    jobId = data.jobId;
    if (!jobId || typeof jobId !== 'string') {
      appendLog('Server response missing jobId.', 'error');
      dialogTitle.textContent = 'Error';
      markDone(false);
      handleScrapeEndCleanup(scrapeBtn);
      return;
    }
  } catch (err) {
    appendLog('Network error: ' + err.message, 'error');
    dialogTitle.textContent = 'Error';
    markDone(false);
    handleScrapeEndCleanup(scrapeBtn);
    return;
  }

  activeJobId = jobId;
  setAbortVisible(true);

  const es = new EventSource(`/api/scrape/events/${encodeURIComponent(jobId)}`);

  es.onmessage = (e) => {
    let event;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }

    if (event.type === 'start') {
      appendLog('Starting scrape…', 'info');
    } else if (event.type === 'page') {
      appendPageLog(event.page, event.count);
    } else if (event.type === 'done') {
      finishStream('done');
      es.close();
      handleScrapeEndCleanup(scrapeBtn);

      if (event.count === 0) {
        appendLog('No items found. Check your selectors and try again.', 'error');
        dialogTitle.textContent = 'No results';
        dialogDot.className = DOT_ERROR;
        closeBtnEl.disabled = false;
        pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-error';
        pillLabel.textContent = 'No results';
        dialog.removeAttribute('aria-busy');
      } else {
        appendLog(`Done. Total: ${event.count} item${event.count !== 1 ? 's' : ''}.`, 'success');
        dialogTitle.textContent = `Done — ${event.count} items`;
        markDone(true);
        renderResult(event.count, event.preview, event.csvPath);
        pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-success';
        pillLabel.textContent = `Last scrape: ${event.count} items`;
      }
    } else if (event.type === 'error') {
      finishStream('error');
      es.close();
      handleScrapeEndCleanup(scrapeBtn);
      appendLog('Error: ' + event.message, 'error');
      dialogTitle.textContent = 'Error';
      markDone(false);
      pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-error';
      pillLabel.textContent = 'Error — click to view';
    } else if (event.type === 'warning') {
      const msg = event.warning?.message || 'A warning occurred during scraping.';
      appendLog('⚠ Warning: ' + msg, 'warn');
    } else if (event.type === 'cancelled') {
      finishStream('cancelled');
      es.close();
      handleScrapeEndCleanup(scrapeBtn);
      appendLog('Scrape cancelled. No CSV was written.', 'warn');
      dialogTitle.textContent = 'Cancelled';
      markCancelled();
      pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-warn';
      pillLabel.textContent = 'Cancelled';
    }
  };

  es.onerror = () => {
    es.close();
    if (streamClosedReason) return;
    handleScrapeEndCleanup(scrapeBtn);
    appendLog('Connection lost.', 'error');
    dialogTitle.textContent = 'Error';
    markDone(false);
    pillDot.className = 'h-2 w-2 shrink-0 rounded-full bg-error';
    pillLabel.textContent = 'Error — click to view';
  };
});

$('theme-toggle').addEventListener('click', toggleTheme);
updateThemeToggleUI(getTheme());

loadDefaults();
