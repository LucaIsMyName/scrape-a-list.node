import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { downloadCsv } from '@/lib/api';
import type { HistoryEntry, HistoryStatus } from '@/lib/types';

type HistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: HistoryEntry[];
};

function statusLabel(status: HistoryStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'zero') return 'No results';
  if (status === 'cancelled') return 'Cancelled';
  return 'Error';
}

function statusVariant(status: HistoryStatus): 'success' | 'warning' | 'destructive' {
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'warning';
  return 'destructive';
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

export function HistorySheet({ open, onOpenChange, entries }: HistorySheetProps) {
  async function handleDownload(entry: HistoryEntry) {
    if (!entry.csvPath) {
      toast.error('No CSV was saved for this run.');
      return;
    }
    try {
      await downloadCsv(entry.csvPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Scrape history</SheetTitle>
          <SheetDescription>
            Recent runs from this browser. Downloads only work while the CSV is still on the server.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scrapes yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={entry.url}>
                        {entry.url}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatTime(entry.finishedAt)}</p>
                      {entry.presetName ? (
                        <p className="mt-1 text-xs text-muted-foreground">Preset: {entry.presetName}</p>
                      ) : null}
                    </div>
                    <Badge variant={statusVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {entry.count == null ? '—' : `${entry.count} item${entry.count !== 1 ? 's' : ''}`}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!entry.csvPath}
                      onClick={() => void handleDownload(entry)}
                    >
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
