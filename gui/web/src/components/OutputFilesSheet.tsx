import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResultTable } from '@/components/ResultTable';
import { deleteOutputFile, downloadCsv, listOutputFiles, previewOutputFile } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import type { OutputFile, OutputPreview } from '@/lib/types';

type OutputFilesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OutputFilesSheet({ open, onOpenChange }: OutputFilesSheetProps) {
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<OutputPreview | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listOutputFiles();
      setFiles(data.files);
      setTotalBytes(data.totalBytes);
      setLimitBytes(data.limitBytes);
      if (previewPath && !data.files.some((file) => file.path === previewPath)) {
        setPreviewPath(null);
        setPreview(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not list CSV files.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function handlePreview(file: OutputFile) {
    if (previewPath === file.path) {
      setPreviewPath(null);
      setPreview(null);
      return;
    }
    try {
      const next = await previewOutputFile(file.path);
      setPreviewPath(file.path);
      setPreview(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview CSV.');
    }
  }

  async function handleDelete(file: OutputFile) {
    if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return;
    try {
      await deleteOutputFile(file.path);
      toast.success(`Deleted ${file.name}`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete CSV.');
    }
  }

  const usage = limitBytes > 0 ? Math.min(100, (totalBytes / limitBytes) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Output CSVs</SheetTitle>
          <SheetDescription>
            Files in the output folder. Oldest files are removed automatically if the folder exceeds{' '}
            {limitBytes ? formatBytes(limitBytes) : 'the storage limit'}.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(totalBytes)} used
              {limitBytes ? ` of ${formatBytes(limitBytes)}` : ''}
            </span>
            <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${usage}%` }} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {loading && !files.length ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No CSV files in output/.</p>
          ) : (
            <ul className="space-y-3">
              {files.map((file) => {
                const expanded = previewPath === file.path;
                return (
                  <li key={file.path} className="rounded-lg border border-border">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" title={file.name}>
                            {file.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatBytes(file.size)} · {new Date(file.mtimeMs).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handlePreview(file)}
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown /> : <ChevronRight />}
                          Preview
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void downloadCsv(file.path).catch((error) =>
                              toast.error(error instanceof Error ? error.message : 'Download failed.'),
                            )
                          }
                        >
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(file)}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {expanded && preview ? (
                      <div className="max-h-72 border-t border-border">
                        <ResultTable
                          count={preview.rows.length}
                          preview={preview.rows}
                          note={
                            preview.truncated
                              ? 'Showing the first 20 rows. Download for the full CSV.'
                              : undefined
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
