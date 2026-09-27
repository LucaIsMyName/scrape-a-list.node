import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldEditor } from '@/components/FieldEditor';
import type { FieldRow, FormState, LoadedConfig } from '@/lib/types';

const GLOBAL_PRESET = '__global__';

type ConfigFormProps = {
  form: FormState;
  formDirty: boolean;
  presets: LoadedConfig['presets'];
  onUpdate: (patch: Partial<FormState>) => void;
  onFieldChange: (id: string, patch: Partial<FieldRow>) => void;
  onAddField: () => void;
  onRemoveField: (id: string) => void;
  onPresetChange: (presetName: string) => Promise<void>;
};

export function ConfigForm({
  form,
  formDirty,
  presets,
  onUpdate,
  onFieldChange,
  onAddField,
  onRemoveField,
  onPresetChange,
}: ConfigFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="preset">Preset</Label>
          <Select
            value={form.preset || GLOBAL_PRESET}
            onValueChange={async (value) => {
              const next = value === GLOBAL_PRESET ? '' : value;
              if (formDirty && !window.confirm('Replace your edits with this preset?')) {
                return;
              }
              await onPresetChange(next);
            }}
          >
            <SelectTrigger id="preset">
              <SelectValue placeholder="Global defaults" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GLOBAL_PRESET}>Global defaults</SelectItem>
              {presets.map((preset) => (
                <SelectItem key={preset.presetName} value={preset.presetName}>
                  {preset.presetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="url">Starting page URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com/concerts"
            value={form.url}
            onChange={(event) => onUpdate({ url: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="container">List container selector</Label>
            <Input
              id="container"
              placeholder=".event-list"
              value={form.container}
              onChange={(event) => onUpdate({ container: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="item">Item selector</Label>
            <Input
              id="item"
              placeholder=".event-card"
              value={form.item}
              onChange={(event) => onUpdate({ item: event.target.value })}
            />
          </div>
        </div>
        <FieldEditor
          fields={form.fields}
          onChange={onFieldChange}
          onAdd={onAddField}
          onRemove={onRemoveField}
        />
        <div>
          <Label htmlFor="output">
            Output filename <span className="font-normal">(suggested from preset — edit anytime)</span>
          </Label>
          <Input
            id="output"
            placeholder="preset-name-20260101123000.csv"
            value={form.output}
            onChange={(event) => onUpdate({ output: event.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
