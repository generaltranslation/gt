import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeStatus, type ComputeStatusInput } from '../computeStatus.js';
import {
  TEMPLATE_FILE_NAME,
  TEMPLATE_FILE_ID,
} from '../../../utils/constants.js';
import type { FileToUpload } from 'generaltranslation/types';
import { buildEntryMap } from '../../../fs/config/downloadedVersions.js';

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-status-test-'));
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

function write(relPath: string, content: unknown) {
  const abs = path.join(cwd, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    typeof content === 'string' ? content : JSON.stringify(content)
  );
}

function baseInput(overrides: Partial<ComputeStatusInput>): ComputeStatusInput {
  return {
    sourceFiles: [],
    fileMapping: {},
    lockEntries: buildEntryMap([]),
    locales: ['es'],
    cwd,
    resolveJsonSchema: () => ({ kind: 'none' }),
    ...overrides,
  };
}

function gtTemplate(content: Record<string, unknown>): FileToUpload {
  return {
    fileName: TEMPLATE_FILE_NAME,
    fileId: TEMPLATE_FILE_ID,
    versionId: 'gt-v1',
    fileFormat: 'GTJSON',
    locale: 'en',
    content: JSON.stringify(content),
    formatMetadata: Object.fromEntries(
      Object.keys(content).map((key) => [key, { dataFormat: 'ICU' }])
    ),
  };
}

describe('computeStatus: GT inline catalog', () => {
  it('diffs source hashes against the locale catalog', () => {
    write('gt/es.json', { h1: 'Hola {name}', h9: 'huérfano' });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [gtTemplate({ h1: 'Hello {name}', h2: 'Goodbye' })],
        fileMapping: { es: { [TEMPLATE_FILE_NAME]: 'gt/es.json' } },
      })
    );
    expect(rows).toHaveLength(1);
    const es = rows[0];
    expect(es.locale).toBe('es');
    expect(es.total).toBe(2);
    expect(es.translated).toBe(1);
    expect(es.missing).toEqual([{ fileName: 'gt/es.json', key: 'h2' }]);
    expect(es.stale).toEqual([{ fileName: 'gt/es.json', key: 'h9' }]);
    expect(es.errors).toEqual([]);
  });

  it('counts every hash missing when the locale catalog does not exist', () => {
    const rows = computeStatus(
      baseInput({
        sourceFiles: [gtTemplate({ h1: 'Hello', h2: 'Goodbye' })],
        fileMapping: { es: { [TEMPLATE_FILE_NAME]: 'gt/es.json' } },
      })
    );
    expect(rows[0].total).toBe(2);
    expect(rows[0].translated).toBe(0);
    expect(rows[0].missing).toHaveLength(2);
  });

  it('validates ICU structure for ICU-format string entries', () => {
    write('gt/es.json', { h1: 'Hola {nam}' });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [gtTemplate({ h1: 'Hello {name}' })],
        fileMapping: { es: { [TEMPLATE_FILE_NAME]: 'gt/es.json' } },
      })
    );
    expect(rows[0].errors).toHaveLength(2);
    expect(rows[0].errors[0].fileName).toBe('gt/es.json');
    expect(rows[0].errors[0].key).toBe('h1');
  });

  it('skips ICU validation for JSX entries and non-ICU data formats', () => {
    write('gt/es.json', {
      jsx1: ['nested', { branch: 'x' }],
      s1: 'terrible {ICU',
    });
    const template: FileToUpload = {
      ...gtTemplate({ jsx1: ['nested', { branch: 'y' }], s1: 'plain {text' }),
      formatMetadata: {
        jsx1: { dataFormat: 'JSX' },
        s1: { dataFormat: 'STRING' },
      },
    };
    const rows = computeStatus(
      baseInput({
        sourceFiles: [template],
        fileMapping: { es: { [TEMPLATE_FILE_NAME]: 'gt/es.json' } },
      })
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].translated).toBe(2);
  });
});

describe('computeStatus: JSON catalogs', () => {
  const jsonFile = (over: Partial<FileToUpload> = {}): FileToUpload => ({
    fileName: 'messages/en.json',
    fileId: 'json-file-id',
    versionId: 'v2',
    fileFormat: 'JSON',
    dataFormat: 'ICU',
    locale: 'en',
    content: JSON.stringify({ a: 'Hi {x}', b: { c: 'Yo' } }),
    ...over,
  });

  it('diffs string leaves by JSON pointer and validates ICU', () => {
    write('messages/es.json', { a: 'Hola {y}' });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile()],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
      })
    );
    const es = rows[0];
    expect(es.total).toBe(2);
    expect(es.translated).toBe(1);
    expect(es.missing).toEqual([{ fileName: 'messages/es.json', key: '/b/c' }]);
    expect(es.errors).toHaveLength(2);
    expect(es.errors[0].key).toBe('/a');
  });

  it('skips ICU validation for non-ICU data formats', () => {
    write('messages/es.json', { a: 'Hola {{y}}', b: { c: 'Ey' } });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile({ dataFormat: 'I18NEXT' })],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
      })
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].translated).toBe(2);
  });

  it('marks the file stale when the lockfile version differs from the current source', () => {
    write('messages/es.json', { a: 'Hola {x}', b: { c: 'Ey' } });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile()],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
        lockEntries: buildEntryMap([
          {
            fileId: 'json-file-id',
            versionId: 'v1-outdated',
            translations: { es: { updatedAt: '2026-01-01' } },
          },
        ]),
      })
    );
    expect(rows[0].stale).toEqual([{ fileName: 'messages/es.json' }]);
    expect(rows[0].translated).toBe(2);
  });

  it('does not mark stale when the lockfile version matches', () => {
    write('messages/es.json', { a: 'Hola {x}', b: { c: 'Ey' } });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile()],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
        lockEntries: buildEntryMap([
          {
            fileId: 'json-file-id',
            versionId: 'v2',
            translations: { es: { updatedAt: '2026-01-01' } },
          },
        ]),
      })
    );
    expect(rows[0].stale).toEqual([]);
  });

  it('treats an unparsable translated file as fully missing with an error', () => {
    write('messages/es.json', '{ not json');
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile()],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
      })
    );
    expect(rows[0].translated).toBe(0);
    expect(rows[0].missing).toHaveLength(2);
    expect(rows[0].errors).toHaveLength(1);
    expect(rows[0].errors[0].message).toMatch(/not valid JSON/);
  });

  it('uses configured include paths to flatten translated files', () => {
    write('content/es.json', { title: 'Hola', ignored: 'nope' });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [
          jsonFile({
            fileName: 'content/en.json',
            content: JSON.stringify({ '/title': 'Hello' }),
          }),
        ],
        fileMapping: { es: { 'content/en.json': 'content/es.json' } },
        resolveJsonSchema: () => ({ kind: 'include', include: ['$.title'] }),
      })
    );
    expect(rows[0].total).toBe(1);
    expect(rows[0].translated).toBe(1);
    expect(rows[0].missing).toEqual([]);
  });

  it('reports composite JSON files as unmeasured instead of translated', () => {
    // Composite files keep every locale inside one file, so its mapped
    // output always exists; counting it as covered would fake 100%
    write('composite.json', { en: { a: 'Hi' } });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [
          jsonFile({
            fileName: 'composite.json',
            content: JSON.stringify({ en: { a: 'Hi' } }),
          }),
        ],
        fileMapping: { es: { 'composite.json': 'composite.json' } },
        resolveJsonSchema: () => ({ kind: 'composite' }),
      })
    );
    expect(rows[0].total).toBe(0);
    expect(rows[0].translated).toBe(0);
    expect(rows[0].unmeasured).toEqual([{ fileName: 'composite.json' }]);
    expect(rows[0].errors).toEqual([]);
  });

  it('suppresses orphan-key stales for a file already stale via the lockfile', () => {
    write('messages/es.json', { a: 'Hola {x}', b: { c: 'Ey' }, gone: 'x' });
    const rows = computeStatus(
      baseInput({
        sourceFiles: [jsonFile()],
        fileMapping: { es: { 'messages/en.json': 'messages/es.json' } },
        lockEntries: buildEntryMap([
          {
            fileId: 'json-file-id',
            versionId: 'v1-outdated',
            translations: { es: { updatedAt: '2026-01-01' } },
          },
        ]),
      })
    );
    // One file-level stale unit, not one per orphan key on top of it
    expect(rows[0].stale).toEqual([{ fileName: 'messages/es.json' }]);
  });

  it('collapses i18next plural families instead of flagging CLDR categories', () => {
    write('locales/ru.json', {
      item_one: '# элемент',
      item_few: '# элемента',
      item_many: '# элементов',
      item_other: '# элемента',
    });
    const rows = computeStatus(
      baseInput({
        locales: ['ru'],
        sourceFiles: [
          jsonFile({
            fileName: 'locales/en.json',
            dataFormat: 'I18NEXT',
            content: JSON.stringify({
              item_one: '# item',
              item_other: '# items',
            }),
          }),
        ],
        fileMapping: { ru: { 'locales/en.json': 'locales/ru.json' } },
      })
    );
    expect(rows[0].total).toBe(1);
    expect(rows[0].translated).toBe(1);
    expect(rows[0].missing).toEqual([]);
    expect(rows[0].stale).toEqual([]);
    expect(rows[0].errors).toEqual([]);
  });
});

describe('computeStatus: file units', () => {
  const mdxFile = (name: string): FileToUpload => ({
    fileName: name,
    fileId: `id-${name}`,
    versionId: 'v1',
    fileFormat: 'MDX',
    locale: 'en',
    content: '# Hello',
  });

  it('counts document files as present or missing per locale', () => {
    write('docs/es/a.mdx', '# Hola');
    const rows = computeStatus(
      baseInput({
        sourceFiles: [mdxFile('docs/en/a.mdx'), mdxFile('docs/en/b.mdx')],
        fileMapping: {
          es: {
            'docs/en/a.mdx': 'docs/es/a.mdx',
            'docs/en/b.mdx': 'docs/es/b.mdx',
          },
        },
      })
    );
    expect(rows[0].total).toBe(2);
    expect(rows[0].translated).toBe(1);
    expect(rows[0].missing).toEqual([{ fileName: 'docs/es/b.mdx' }]);
  });

  it('marks document files stale on lockfile version mismatch', () => {
    write('docs/es/a.mdx', '# Hola');
    const rows = computeStatus(
      baseInput({
        sourceFiles: [mdxFile('docs/en/a.mdx')],
        fileMapping: { es: { 'docs/en/a.mdx': 'docs/es/a.mdx' } },
        lockEntries: buildEntryMap([
          {
            fileId: 'id-docs/en/a.mdx',
            versionId: 'v0-outdated',
            translations: { es: {} },
          },
        ]),
      })
    );
    expect(rows[0].stale).toEqual([{ fileName: 'docs/es/a.mdx' }]);
  });

  it('reports lockfile entries whose source no longer exists as stale', () => {
    const rows = computeStatus(
      baseInput({
        locales: ['es', 'fr'],
        sourceFiles: [],
        fileMapping: { es: {}, fr: {} },
        lockEntries: buildEntryMap([
          {
            fileId: 'ghost',
            fileName: 'docs/en/removed.mdx',
            versionId: 'v1',
            translations: {
              es: { fileName: 'docs/es/removed.mdx' },
            },
          },
        ]),
      })
    );
    const es = rows.find((r) => r.locale === 'es')!;
    const fr = rows.find((r) => r.locale === 'fr')!;
    expect(es.stale).toEqual([{ fileName: 'docs/es/removed.mdx' }]);
    expect(fr.stale).toEqual([]);
  });

  it('skips source files with no mapped output for the locale', () => {
    const rows = computeStatus(
      baseInput({
        sourceFiles: [mdxFile('docs/en/a.mdx')],
        fileMapping: { es: {} },
      })
    );
    expect(rows[0].total).toBe(0);
    expect(rows[0].missing).toEqual([]);
  });

  it('returns one row per requested locale, in order', () => {
    const rows = computeStatus(
      baseInput({
        locales: ['fr', 'es'],
        sourceFiles: [mdxFile('docs/en/a.mdx')],
        fileMapping: {
          fr: { 'docs/en/a.mdx': 'docs/fr/a.mdx' },
          es: { 'docs/en/a.mdx': 'docs/es/a.mdx' },
        },
      })
    );
    expect(rows.map((r) => r.locale)).toEqual(['fr', 'es']);
  });
});
