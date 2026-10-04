import { Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResultTable } from '@/components/ResultTable';
import { cn } from '@/lib/utils';
import type { DialogMode, JobPhase, PreviewRow } from '@/lib/types';

type ScrapeDialogProps = {
  mode: DialogMode;
  phase: JobPhase;
  title: string;
  lastPage: number | null;
  totalItems: number;
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
  resultCount,
  preview,
  canStop,
  scraping,
  onMinimize,
  onClose,
  onStop,
  onDownload,
}: ScrapeDialogProps) {
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
        className="overflow-hidden pb-4 sm:max-w-2xl"
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
        <SheetHeader className="shrink-0 pr-2">
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
                <SheetDescription>
                  {scraping ? 'Scraping in progress…' : 'Scrape progress'}
                </SheetDescription>
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

        {showResult ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border">
            <ResultTable count={resultCount} preview={preview} onDownload={onDownload} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
