import { useEffect, useRef } from 'react';
import { Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResultTable } from '@/components/ResultTable';
import { cn } from '@/lib/utils';
import type { DialogMode, JobPhase, LogLine, PreviewRow } from '@/lib/types';

type ScrapeDialogProps = {
  mode: DialogMode;
  phase: JobPhase;
  title: string;
  lastPage: number | null;
  totalItems: number;
  logLines: LogLine[];
  resultCount: number;
  preview: PreviewRow[];
  canStop: boolean;
  scraping: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onStop: () => void;
  onDownload: () => void;
};

function statusDotClass(phase: JobPhase): string {
  if (phase === 'done') return 'bg-success-foreground';
  if (phase === 'error' || phase === 'zero') return 'bg-destructive-foreground';
  if (phase === 'cancelled') return 'bg-warning-foreground';
  return 'bg-primary animate-pulse';
}

export function ScrapeDialog({
  mode,
  phase,
  title,
  lastPage,
  totalItems,
  logLines,
  resultCount,
  preview,
  canStop,
  scraping,
  onMinimize,
  onClose,
  onStop,
  onDownload,
}: ScrapeDialogProps) {
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logLines]);

  const showResult = phase === 'done' && resultCount > 0;

  return (
    <Sheet
      open={mode === 'open'}
      onOpenChange={(open) => {
        if (open) return;
        if (scraping) onMinimize();
        else onClose();
      }}
    >
      <SheetContent
        showClose={false}
        className="sm:max-w-2xl"
        aria-busy={scraping}
        onPointerDownOutside={(event) => {
          if (scraping) {
            event.preventDefault();
            return;
          }
          onClose();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (scraping) onMinimize();
          else onClose();
        }}
        onInteractOutside={(event) => {
          if (scraping) event.preventDefault();
        }}
      >
        <SheetHeader className="pr-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(phase))} />
                <SheetTitle className="truncate text-base">{title}</SheetTitle>
              </div>
              {lastPage != null ? (
                <SheetDescription>
                  Page {lastPage} · {totalItems} item{totalItems !== 1 ? 's' : ''} total
                </SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Scrape progress</SheetDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canStop ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-warning-foreground/40 bg-warning text-[0.72rem] font-bold uppercase tracking-wide text-warning-foreground hover:bg-warning/80"
                  onClick={onStop}
                >
                  Stop
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon" title="Minimise" aria-label="Minimise" onClick={onMinimize}>
                <Minus />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Close"
                aria-label="Close"
                disabled={scraping}
                onClick={onClose}
              >
                <X />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="mx-6 min-h-[120px] rounded-md border border-border bg-background">
          <div aria-live="polite" aria-label="Scrape log" className="px-3 py-2 font-mono text-xs leading-relaxed">
            {logLines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'whitespace-pre',
                  line.kind === 'success' && 'font-medium text-success-foreground',
                  line.kind === 'error' && 'font-medium text-destructive-foreground',
                  line.kind === 'warn' && 'font-medium text-warning-foreground',
                  line.kind === 'info' && 'text-muted-foreground',
                  line.kind === 'page' && 'text-muted-foreground',
                )}
              >
                {line.kind === 'page' ? (
                  <>
                    {'  Page '}
                    <span className="text-primary">{line.page}</span>
                    {': '}
                    <span className="text-foreground">{line.count}</span>
                    {` item${line.count !== 1 ? 's' : ''}`}
                  </>
                ) : (
                  line.text
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </ScrollArea>

        {showResult ? (
          <div className="flex min-h-0 flex-1 flex-col border-t border-border">
            <ResultTable count={resultCount} preview={preview} onDownload={onDownload} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
