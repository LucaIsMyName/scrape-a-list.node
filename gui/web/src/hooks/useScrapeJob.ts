import { useCallback, useRef, useState } from 'react';
import { cancelScrape, startScrape } from '@/lib/api';
import { openScrapeEvents } from '@/lib/sse';
import { loadHistory, prependHistory } from '@/lib/storage';
import type {
  DialogMode,
  HistoryEntry,
  JobPhase,
  LogKind,
  LogLine,
  PreviewRow,
  ScrapeBody,
} from '@/lib/types';

function line(kind: LogKind, text: string, extra?: Partial<LogLine>): LogLine {
  return { id: crypto.randomUUID(), kind, text, ...extra };
}

export function useScrapeJob() {
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [dialogMode, setDialogMode] = useState<DialogMode>('hidden');
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [lastPage, setLastPage] = useState<number | null>(null);
  const [title, setTitle] = useState('Scraping…');
  const [csvPath, setCsvPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [pillLabel, setPillLabel] = useState('Last scrape');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const closeStreamRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const contextRef = useRef({ url: '', presetName: '' });

  const scraping = phase === 'starting' || phase === 'running';

  const appendLog = useCallback((kind: LogKind, text: string, extra?: Partial<LogLine>) => {
    setLogLines((prev) => [...prev, line(kind, text, extra)]);
  }, []);

  const resetDialog = useCallback(() => {
    setLogLines([]);
    setTotalItems(0);
    setLastPage(null);
    setTitle('Scraping…');
    setCsvPath(null);
    setPreview([]);
    setResultCount(0);
    jobIdRef.current = null;
    setActiveJobId(null);
  }, []);

  const recordHistory = useCallback(
    (entry: Omit<HistoryEntry, 'startedAt' | 'finishedAt' | 'url' | 'presetName'> & { id: string }) => {
      const next = prependHistory({
        ...entry,
        startedAt: startedAtRef.current,
        finishedAt: Date.now(),
        url: contextRef.current.url,
        presetName: contextRef.current.presetName,
      });
      setHistory(next);
    },
    [],
  );

  const start = useCallback(
    async (body: ScrapeBody, presetName: string) => {
      closeStreamRef.current?.();
      resetDialog();
      contextRef.current = { url: body.url, presetName };
      startedAtRef.current = Date.now();
      setPhase('starting');
      setDialogMode('open');
      setPillLabel('Scraping in progress…');

      let jobId: string;
      try {
        jobId = await startScrape(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        appendLog('error', `Error: ${message}`);
        setTitle('Error');
        setPhase('error');
        setPillLabel('Error — click to view');
        recordHistory({ id: crypto.randomUUID(), status: 'error', count: null, csvPath: null });
        return;
      }

      jobIdRef.current = jobId;
      setActiveJobId(jobId);
      setPhase('running');

      closeStreamRef.current = openScrapeEvents(jobId, {
        onEvent: (event) => {
          if (event.type === 'start') {
            appendLog('info', 'Starting scrape…');
          } else if (event.type === 'page') {
            setTotalItems((prev) => prev + event.count);
            setLastPage(event.page);
            appendLog('page', '', { page: event.page, count: event.count });
          } else if (event.type === 'warning') {
            appendLog('warn', `⚠ Warning: ${event.warning?.message || 'A warning occurred during scraping.'}`);
          } else if (event.type === 'done') {
            jobIdRef.current = null;
            setActiveJobId(null);
            if (event.count === 0) {
              appendLog('error', 'No items found. Check your selectors and try again.');
              setTitle('No results');
              setPhase('zero');
              setPillLabel('No results');
              recordHistory({ id: jobId, status: 'zero', count: 0, csvPath: null });
            } else {
              appendLog(
                'success',
                `Done. Total: ${event.count} item${event.count !== 1 ? 's' : ''}.`,
              );
              setTitle(`Done — ${event.count} items`);
              setPhase('done');
              setResultCount(event.count);
              setPreview(event.preview || []);
              setCsvPath(event.csvPath || null);
              setPillLabel(`Last scrape: ${event.count} items`);
              recordHistory({
                id: jobId,
                status: 'done',
                count: event.count,
                csvPath: event.csvPath || null,
              });
            }
          } else if (event.type === 'error') {
            jobIdRef.current = null;
            setActiveJobId(null);
            appendLog('error', `Error: ${event.message}`);
            setTitle('Error');
            setPhase('error');
            setPillLabel('Error — click to view');
            recordHistory({ id: jobId, status: 'error', count: null, csvPath: null });
          } else if (event.type === 'cancelled') {
            jobIdRef.current = null;
            setActiveJobId(null);
            appendLog('warn', 'Scrape cancelled. No CSV was written.');
            setTitle('Cancelled');
            setPhase('cancelled');
            setPillLabel('Cancelled');
            recordHistory({ id: jobId, status: 'cancelled', count: null, csvPath: null });
          }
        },
        onConnectionLost: () => {
          jobIdRef.current = null;
          setActiveJobId(null);
          appendLog('error', 'Connection lost.');
          setTitle('Error');
          setPhase('error');
          setPillLabel('Error — click to view');
          recordHistory({ id: jobId, status: 'error', count: null, csvPath: null });
        },
      });
    },
    [appendLog, recordHistory, resetDialog],
  );

  const cancel = useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId) return;
    const result = await cancelScrape(jobId);
    if ('error' in result) {
      appendLog('error', result.error);
      if (result.status === 409) {
        jobIdRef.current = null;
        setActiveJobId(null);
      }
    }
  }, [appendLog]);

  const minimize = useCallback(() => setDialogMode('minimized'), []);
  const restore = useCallback(() => setDialogMode('open'), []);
  const close = useCallback(() => {
    if (scraping) return;
    setDialogMode('hidden');
  }, [scraping]);

  return {
    phase,
    scraping,
    dialogMode,
    logLines,
    totalItems,
    lastPage,
    title,
    csvPath,
    preview,
    resultCount,
    history,
    pillLabel,
    canStop: scraping && Boolean(activeJobId),
    start,
    cancel,
    minimize,
    restore,
    close,
  };
}
