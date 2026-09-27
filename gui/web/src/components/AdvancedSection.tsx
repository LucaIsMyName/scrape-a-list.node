import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FormState } from '@/lib/types';

type AdvancedSectionProps = {
  form: FormState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (patch: Partial<FormState>) => void;
};

export function AdvancedSection({ form, open, onOpenChange, onUpdate }: AdvancedSectionProps) {
  return (
    <Card>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between px-5 py-5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-7"
          aria-expanded={open}
        >
          <span>Advanced</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="retry-attempts">Retries per request</Label>
                <Input
                  id="retry-attempts"
                  type="number"
                  min={0}
                  placeholder="Server default"
                  value={form.retryAttempts}
                  onChange={(event) => onUpdate({ retryAttempts: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="retry-delay-ms">Retry delay (ms)</Label>
                <Input
                  id="retry-delay-ms"
                  type="number"
                  min={0}
                  placeholder="Server default"
                  value={form.retryDelayMs}
                  onChange={(event) => onUpdate({ retryDelayMs: event.target.value })}
                />
              </div>
            </div>
            <div className="max-w-[10rem]">
              <Label htmlFor="page-delay-ms">Delay between pages (ms)</Label>
              <Input
                id="page-delay-ms"
                type="number"
                min={0}
                placeholder="Server default"
                value={form.pageDelayMs}
                onChange={(event) => onUpdate({ pageDelayMs: event.target.value })}
              />
            </div>
            <label className="flex cursor-pointer select-none items-center gap-3" htmlFor="fail-on-page-error">
              <Checkbox
                id="fail-on-page-error"
                checked={form.failOnPageError}
                onCheckedChange={(checked) => onUpdate({ failOnPageError: checked === true })}
              />
              <span className="text-sm">Fail the run on HTTP errors during pagination</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Leave retry fields empty to use server environment defaults.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
