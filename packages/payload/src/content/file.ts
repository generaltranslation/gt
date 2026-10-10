// A document's strings as one HTML file: a `<div data-gt-key>` per string,
// plain text escaped and rich text as tagged inline content.
import { createHash } from 'node:crypto';
import { parse, serialize } from 'parse5';
import type { FlattenedField } from 'payload';
import { walkFields, type FieldContext } from './fields';
import {
  escapeAttribute,
  encodePlainText,
  isElement,
  type HtmlParent,
} from './html';
import type { Data } from '../types';
import { encodeElement } from './inline';

export type Unit = {
  key: string;
  source: string;
  // The target locale's current text at the same place, when asked for.
  target?: string;
  // The target has text here that cannot be sent as its translation, as its
  // links differ from the source's.
  unsaved?: true;
};

// The id a string carries in the file: a hash of its field path. Field names
// such as `meta.description` read like page metadata, and models leave them
// untranslated.
export function fileKey(key: string): string {
  return `k${createHash('sha256').update(key).digest('hex').slice(0, 12)}`;
}

// The document's translatable strings, with the target's current text at the
// same places when a target document is given.
export function collectUnits(
  fields: FlattenedField[],
  source: Data,
  target: Data | undefined,
  ctx: FieldContext
): Unit[] {
  const units: Unit[] = [];
  walkFields(
    fields,
    source,
    target,
    '',
    false,
    {
      text(key, value, current) {
        units.push({
          key,
          source: encodePlainText(value),
          target: current === undefined ? undefined : encodePlainText(current),
        });
        return undefined;
      },
      element(key, encoded, current) {
        const currentEncoded = current
          ? encodeElement(current, encoded)
          : undefined;
        units.push({
          key,
          source: encoded.html,
          target: currentEncoded?.html || undefined,
          ...(currentEncoded === null &&
            (current?.children ?? []).length > 0 && { unsaved: true as const }),
        });
        return undefined;
      },
    },
    ctx
  );
  return units;
}

function buildFile(entries: [string, string][]): string {
  const body = entries
    .map(
      ([key, html]) =>
        `<div data-gt-key="${escapeAttribute(fileKey(key))}">${html}</div>`
    )
    .join('\n');
  return `<!DOCTYPE html>\n<html><body>\n${body}\n</body></html>\n`;
}

export function sourceFile(units: Unit[]): string {
  return buildFile(units.map((u) => [u.key, u.source]));
}

// The target's current text as a file, or null when it has none.
export function targetFile(units: Unit[]): string | null {
  const entries = units.flatMap((u): [string, string][] =>
    u.target ? [[u.key, u.target]] : []
  );
  return entries.length ? buildFile(entries) : null;
}

// File key to inner HTML for every keyed string in a translated file.
export function readFile(content: string): Map<string, string> {
  const values = new Map<string, string>();
  const visit = (node: HtmlParent) => {
    for (const child of node.childNodes) {
      if (!isElement(child)) continue;
      const key = child.attrs.find((a) => a.name === 'data-gt-key')?.value;
      if (key === undefined) visit(child);
      else values.set(key, serialize(child));
    }
  };
  visit(parse(content));
  return values;
}
