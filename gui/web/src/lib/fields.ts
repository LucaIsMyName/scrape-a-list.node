import type { FieldRow } from './types';

const FIELD_ATTR_SUFFIX = /^(.+)@([A-Za-z][\w-]*)$/;

export function createFieldRow(
  partial: Partial<Omit<FieldRow, 'id'>> & { id?: string } = {},
): FieldRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? '',
    selector: partial.selector ?? '',
    attribute: partial.attribute ?? '',
  };
}

export function parseFieldsString(fieldsStr: string): FieldRow[] {
  return fieldsStr
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) {
        throw new Error(
          `Invalid field format: "${pair}". Expected "name:selector" or "name:selector@attribute".`,
        );
      }
      const name = pair.slice(0, colonIdx).trim();
      const selectorPart = pair.slice(colonIdx + 1).trim();
      if (!name || !selectorPart) {
        throw new Error(`Invalid field format: "${pair}". Both name and selector are required.`);
      }
      const attrMatch = selectorPart.match(FIELD_ATTR_SUFFIX);
      if (attrMatch) {
        const selector = attrMatch[1].trim();
        const attribute = attrMatch[2];
        if (!selector) {
          throw new Error(
            `Invalid field format: "${pair}". Selector is required before @attribute.`,
          );
        }
        return createFieldRow({ name, selector, attribute });
      }
      if (selectorPart.includes('@')) {
        throw new Error(
          `Invalid field format: "${pair}". Attribute name after @ must start with a letter.`,
        );
      }
      return createFieldRow({ name, selector: selectorPart });
    });
}

export function parseFieldsSafe(fieldsStr: string): FieldRow[] {
  const raw = String(fieldsStr || '').trim();
  if (!raw) return [createFieldRow()];
  try {
    const parsed = parseFieldsString(raw);
    return parsed.length ? parsed : [createFieldRow()];
  } catch {
    return [createFieldRow({ selector: raw })];
  }
}

export function serializeFields(rows: FieldRow[]): string {
  return rows
    .map((row) => {
      const name = row.name.trim();
      const selector = row.selector.trim();
      const attribute = row.attribute.trim();
      if (!name && !selector && !attribute) return '';
      if (attribute) return `${name}:${selector}@${attribute}`;
      return `${name}:${selector}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function validateFieldsClient(fieldsRaw: string): string | null {
  const pairs = fieldsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pairs.length) return 'At least one field is required.';
  const names = new Set<string>();
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) {
      return `Invalid field "${pair}". Expected "name:selector".`;
    }
    const name = pair.slice(0, colonIdx).trim();
    let selector = pair.slice(colonIdx + 1).trim();
    const attrMatch = selector.match(/^(.+)@([A-Za-z][\w-]*)$/);
    if (attrMatch) {
      selector = attrMatch[1].trim();
      if (!selector) {
        return `Invalid field "${pair}". Selector is required before @attribute.`;
      }
    } else if (selector.includes('@')) {
      return `Invalid field "${pair}". Attribute after @ must start with a letter.`;
    }
    if (!name || !selector) {
      return `Invalid field "${pair}". Both name and selector are required.`;
    }
    if (names.has(name)) {
      return `Duplicate field name "${name}".`;
    }
    names.add(name);
  }
  return null;
}
