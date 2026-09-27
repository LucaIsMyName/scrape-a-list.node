import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { serializeFields } from '@/lib/fields';
import type { FieldRow } from '@/lib/types';

type FieldEditorProps = {
  fields: FieldRow[];
  onChange: (id: string, patch: Partial<FieldRow>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function FieldEditor({ fields, onChange, onAdd, onRemove }: FieldEditorProps) {
  const serialized = serializeFields(fields);

  return (
    <div className="space-y-3">
      <div>
        <Label>Fields</Label>
        <p className="text-xs text-muted-foreground">
          One row per column. Leave attribute empty for text; use <code>href</code> or similar to read an attribute.
        </p>
      </div>
      <div className="space-y-3">
        {fields.map((row, index) => (
          <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_0.8fr_auto] sm:items-end">
            <div>
              {index === 0 ? <Label htmlFor={`field-name-${row.id}`}>Name</Label> : null}
              <Input
                id={`field-name-${row.id}`}
                value={row.name}
                placeholder="title"
                onChange={(event) => onChange(row.id, { name: event.target.value })}
              />
            </div>
            <div>
              {index === 0 ? <Label htmlFor={`field-selector-${row.id}`}>Selector</Label> : null}
              <Input
                id={`field-selector-${row.id}`}
                value={row.selector}
                placeholder="h3 a"
                onChange={(event) => onChange(row.id, { selector: event.target.value })}
              />
            </div>
            <div>
              {index === 0 ? <Label htmlFor={`field-attr-${row.id}`}>Attribute</Label> : null}
              <Input
                id={`field-attr-${row.id}`}
                value={row.attribute}
                placeholder="optional"
                onChange={(event) => onChange(row.id, { attribute: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => onRemove(row.id)}
              aria-label={`Remove field ${row.name || index + 1}`}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus />
        Add field
      </Button>
      {serialized ? (
        <p className="font-mono text-xs text-muted-foreground">
          Sent as <code>{serialized}</code>
        </p>
      ) : null}
    </div>
  );
}
