import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronUp, Loader2 } from 'lucide-react';
import { AdvancedSection } from '@/components/AdvancedSection';
import { ConfigForm } from '@/components/ConfigForm';
import { Header } from '@/components/Header';
import { HistorySheet } from '@/components/HistorySheet';
import { OutputFilesSheet } from '@/components/OutputFilesSheet';
import { PaginationSection } from '@/components/PaginationSection';
import { ScrapeDialog } from '@/components/ScrapeDialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useScrapeForm } from '@/hooks/useScrapeForm';
import { useScrapeJob } from '@/hooks/useScrapeJob';
import { useTheme } from '@/hooks/useTheme';
import { downloadCsv } from '@/lib/api';
import { cn } from '@/lib/utils';

function pillDotClass(phase: ReturnType<typeof useScrapeJob>['phase']): string {
  if (phase === 'done') return 'bg-success-foreground';
  if (phase === 'error' || phase === 'zero') return 'bg-destructive-foreground';
  if (phase === 'cancelled') return 'bg-warning-foreground';
  return 'bg-primary';
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const form = useScrapeForm();
  const job = useScrapeJob();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [outputsOpen, setOutputsOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function handleScrape() {
    setInlineError(null);
    const result = form.validateAndBuild();
    if ('error' in result) {
      setInlineError(result.error);
      return;
    }
    await job.start(result.body, form.form.preset);
  }

  async function handleDownload(csvPath: string | null) {
    if (!csvPath) {
      toast.error('No CSV is available for this run.');
      return;
    }
    try {
      await downloadCsv(csvPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-24 pt-8 sm:pb-16 sm:pt-10">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenOutputs={() => setOutputsOpen(true)}
      />

      {form.configError ? (
        <Alert variant="warning" className="mb-4">
          {form.configError}
        </Alert>
      ) : null}

      <div className="space-y-5 mt-8">
        <ConfigForm
          form={form.form}
          formDirty={form.formDirty}
          presets={form.loadedConfig.presets}
          onUpdate={form.updateForm}
          onFieldChange={form.updateFieldRow}
          onAddField={form.addFieldRow}
          onRemoveField={form.removeFieldRow}
          onPresetChange={form.applyPreset}
        />
        <PaginationSection form={form.form} onUpdate={form.updateForm} />
        <AdvancedSection
          form={form.form}
          open={form.advancedOpen}
          onOpenChange={form.setAdvancedOpen}
          onUpdate={form.updateForm}
        />

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={job.scraping}
            onClick={() => void handleScrape()}
          >
            {job.scraping ? <Loader2 className="animate-spin" /> : null}
            {job.scraping ? 'Scraping…' : 'Scrape'}
          </Button>
          {inlineError ? (
            <Alert variant="destructive" className="mt-3">
              {inlineError}
            </Alert>
          ) : null}
        </div>
      </div>

      <ScrapeDialog
        mode={job.dialogMode}
        phase={job.phase}
        title={job.title}
        lastPage={job.lastPage}
        totalItems={job.totalItems}
        resultCount={job.resultCount}
        preview={job.preview}
        canStop={job.canStop}
        scraping={job.scraping}
        onMinimize={job.minimize}
        onClose={job.close}
        onStop={() => void job.cancel()}
        onDownload={() => void handleDownload(job.csvPath)}
      />

      {job.dialogMode === 'minimized' ? (
        <button
          type="button"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-lg transition hover:bg-accent sm:right-6 sm:left-auto sm:translate-x-0"
          onClick={job.restore}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              job.restore();
            }
          }}
          aria-label="Reopen last scrape result"
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-sm', pillDotClass(job.phase))} />
          <span>{job.pillLabel}</span>
          <span aria-hidden="true">
            <ChevronUp className="h-4 w-4" />
          </span>
        </button>
      ) : null}

      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} entries={job.history} />
      <OutputFilesSheet open={outputsOpen} onOpenChange={setOutputsOpen} />
      <Toaster theme={theme} />
    </div>
  );
}
