import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { FormState, PaginationStrategy } from '@/lib/types';

type PaginationSectionProps = {
  form: FormState;
  onUpdate: (patch: Partial<FormState>) => void;
};

export function PaginationSection({ form, onUpdate }: PaginationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagination</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer select-none items-center gap-3" htmlFor="paginate-toggle">
          <Switch
            id="paginate-toggle"
            checked={form.paginate}
            onCheckedChange={(checked) => onUpdate({ paginate: checked })}
          />
          <span className="text-sm sm:text-base">This list spans multiple pages</span>
        </label>

        {form.paginate ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={form.strategy}
                onValueChange={(value) => onUpdate({ strategy: value as PaginationStrategy })}
              >
                <SelectTrigger id="strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="next-link">Follow a &quot;next page&quot; link</SelectItem>
                  <SelectItem value="url-pattern">URL pattern with {'{page}'} placeholder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.strategy === 'next-link' ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="next-selector">CSS selector for the &quot;next page&quot; link</Label>
                  <Input
                    id="next-selector"
                    placeholder="a.pagination-next"
                    value={form.nextSelector}
                    onChange={(event) => onUpdate({ nextSelector: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="next-url-source-selector">
                    Next URL source selector <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="next-url-source-selector"
                    placeholder="#dropdown_months option[selected]"
                    value={form.nextUrlSourceSelector}
                    onChange={(event) => onUpdate({ nextUrlSourceSelector: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use for JS-driven pagination where the visible next control has no href.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="next-url-attribute">
                      Next URL attribute <span className="font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="next-url-attribute"
                      placeholder="value"
                      value={form.nextUrlAttribute}
                      onChange={(event) => onUpdate({ nextUrlAttribute: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="next-sibling-selector">
                      Next sibling selector <span className="font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="next-sibling-selector"
                      placeholder="option"
                      value={form.nextSiblingSelector}
                      onChange={(event) => onUpdate({ nextSiblingSelector: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url-template">URL template</Label>
                  <Input
                    id="url-template"
                    placeholder="https://example.com/concerts?page={page}"
                    value={form.urlTemplate}
                    onChange={(event) => onUpdate({ urlTemplate: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Must contain <code>{'{page}'}</code>
                  </p>
                </div>
                <div className="max-w-[10rem]">
                  <Label htmlFor="max-pages">
                    Max pages <span className="font-normal">(0 = auto)</span>
                  </Label>
                  <Input
                    id="max-pages"
                    type="number"
                    min={0}
                    value={form.maxPages}
                    onChange={(event) => onUpdate({ maxPages: Number(event.target.value) || 0 })}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
