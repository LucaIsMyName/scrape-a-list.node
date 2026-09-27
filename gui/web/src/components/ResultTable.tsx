import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, isHttpUrl } from '@/lib/utils';
import type { PreviewRow } from '@/lib/types';

type ResultTableProps = {
  count: number;
  preview: PreviewRow[];
  onDownload?: () => void;
  note?: string;
};

type SortState = { column: string; direction: 'asc' | 'desc' } | null;

function cellValue(row: PreviewRow, column: string): string {
  return row[column] == null ? '' : String(row[column]);
}

function CellValue({ value }: { value: string }) {
  if (isHttpUrl(value)) {
    return (
      <a
        href={value.trim()}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
        title={value}
      >
        {value}
      </a>
    );
  }
  return value;
}

export function ResultTable({ count, preview, onDownload, note }: ResultTableProps) {
  const columns = preview[0] ? Object.keys(preview[0]) : [];
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(() => {
    const filtered = query.trim()
      ? preview.filter((row) =>
          columns.some((column) => cellValue(row, column).toLowerCase().includes(query.trim().toLowerCase())),
        )
      : preview;
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      const left = cellValue(a, sort.column);
      const right = cellValue(b, sort.column);
      const compared = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? compared : -compared;
    });
  }, [columns, preview, query, sort]);

  function toggleSort(column: string) {
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' };
      if (current.direction === 'asc') return { column, direction: 'desc' };
      return null;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Badge variant="success">
          {count} item{count !== 1 ? 's' : ''}
        </Badge>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {columns.length ? (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter rows"
              className="h-8 max-w-[12rem]"
              aria-label="Filter result rows"
            />
          ) : null}
          {onDownload ? (
            <Button type="button" size="sm" onClick={onDownload}>
              Download CSV
            </Button>
          ) : null}
        </div>
      </div>
      {columns.length ? (
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => {
                  const active = sort?.column === column;
                  return (
                    <TableHead key={column}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort(column)}
                      >
                        {column}
                        {active && sort.direction === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : active && sort.direction === 'desc' ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-50" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} className={cn(index % 2 === 1 && 'bg-row-alt', 'hover:bg-accent/70')}>
                  {columns.map((column) => {
                    const value = cellValue(row, column);
                    return (
                      <TableCell
                        key={column}
                        title={value}
                        className={isHttpUrl(value) ? 'max-w-[280px] whitespace-normal' : undefined}
                      >
                        <CellValue value={value} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <p className="shrink-0 px-4 py-2 text-[0.72rem] text-muted-foreground sm:px-5">
        {note ?? (count > 20 ? `Showing first 20 of ${count} rows. Download for the full CSV.` : '')}
        {query && rows.length !== preview.length ? ` ${rows.length} matching.` : ''}
      </p>
    </div>
  );
}
