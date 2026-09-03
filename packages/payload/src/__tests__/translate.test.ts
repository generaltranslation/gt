import type { JsxChildren, TranslationResult } from 'generaltranslation/types';
import type { PayloadRequest } from 'payload';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LexicalState } from '../lexical';
import { buildGtTree } from '../lexical';
import { fixtureState, upperCaseTree } from './fixture';
import {
  buildFieldEntries,
  buildLocaleData,
  createTranslateEndpoint,
  toTranslateEntries,
} from '../translate';

const { translateMany } = vi.hoisted(() => ({ translateMany: vi.fn() }));

vi.mock('generaltranslation', () => ({
  GTRuntime: class {
    translateMany = translateMany;
  },
}));

const doc = (): Record<string, unknown> => ({
  content: fixtureState(),
  emptyText: '   ',
  plainObject: { not: 'lexical' },
  summary: 'A short summary.',
  title: 'Hello world',
});

describe('buildFieldEntries', () => {
  it('skips a richText state with no text nodes', () => {
    const emptyState = {
      root: {
        children: [{ type: 'paragraph', version: 1 }],
        type: 'root',
        version: 1,
      },
    };
    const { entries, skipped } = buildFieldEntries({ content: emptyState }, [
      'content',
    ]);
    expect(entries).toEqual([]);
    expect(skipped).toEqual(['content']);
  });

  it('classifies strings and lexical states and skips the rest', () => {
    const { entries, skipped } = buildFieldEntries(doc(), [
      'title',
      'summary',
      'content',
      'emptyText',
      'plainObject',
      'absent',
    ]);
    expect(entries.map((entry) => [entry.field, entry.kind])).toEqual([
      ['title', 'string'],
      ['summary', 'string'],
      ['content', 'richText'],
    ]);
    expect(skipped).toEqual(['emptyText', 'plainObject', 'absent']);
  });
});

describe('toTranslateEntries', () => {
  it('sends strings bare and trees with the JSX data format', () => {
    const { entries } = buildFieldEntries(doc(), ['title', 'content']);
    const requests = toTranslateEntries(entries);
    expect(requests[0]).toBe('Hello world');
    expect(requests[1]).toMatchObject({ metadata: { dataFormat: 'JSX' } });
  });
});

describe('buildLocaleData', () => {
  const success = (translation: unknown): TranslationResult =>
    ({
      dataFormat: 'STRING',
      locale: 'es',
      success: true,
      translation,
    }) as TranslationResult;

  it('maps results back to fields by position', () => {
    const { entries } = buildFieldEntries(doc(), ['title', 'content']);
    const translatedTree = upperCaseTree(
      buildGtTree(fixtureState()).tree
    ) as JsxChildren;
    const outcome = buildLocaleData(entries, [
      success('Hola mundo'),
      success(translatedTree),
    ]);
    expect(outcome.data.title).toBe('Hola mundo');
    const content = outcome.data.content as LexicalState;
    expect(content.root.children![0].children![0].text).toBe('BREWING AT HOME');
    expect(outcome.failed).toEqual([]);
    expect(outcome.partial).toEqual([]);
  });

  it('records failures without dropping the other fields', () => {
    const { entries } = buildFieldEntries(doc(), ['title', 'summary']);
    const outcome = buildLocaleData(entries, [
      { code: 429, error: 'rate limited', success: false },
      success('Un resumen corto.'),
    ]);
    expect(outcome.data).toEqual({ summary: 'Un resumen corto.' });
    expect(outcome.failed).toEqual([
      { error: 'rate limited (429)', field: 'title' },
    ]);
  });

  it('rejects a non-string translation for a string field', () => {
    const { entries } = buildFieldEntries(doc(), ['title']);
    const outcome = buildLocaleData(entries, [
      success(['unexpected', 'array']),
    ]);
    expect(outcome.data).toEqual({});
    expect(outcome.failed[0].field).toBe('title');
  });

  it('refuses to write a locale whose tree echo matches no text nodes', () => {
    const { entries } = buildFieldEntries(doc(), ['content']);
    const outcome = buildLocaleData(entries, [
      success('a bare string echo, no tree'),
    ]);
    expect(outcome.data).toEqual({});
    expect(outcome.failed).toEqual([
      {
        error: 'translation returned no matching text nodes',
        field: 'content',
      },
    ]);
    expect(outcome.partial).toEqual([]);
  });

  it('flags a missing result and counts untranslated text nodes as partial', () => {
    const { entries } = buildFieldEntries(doc(), ['content', 'title']);
    const bare = buildGtTree(fixtureState()).tree;
    const stripped = structuredClone(bare) as { c: { c?: unknown }[] };
    delete (stripped.c[0] as { c: { i?: number }[] }).c[0].i;
    const outcome = buildLocaleData(entries, [
      success(stripped as JsxChildren),
    ]);
    expect(outcome.partial).toEqual([
      { field: 'content', missingTextNodes: 1 },
    ]);
    expect(outcome.failed).toEqual([
      { error: 'no result returned', field: 'title' },
    ]);
  });
});

describe('createTranslateEndpoint', () => {
  beforeEach(() => {
    translateMany.mockReset();
  });

  const makeReq = (overrides: Record<string, unknown>): PayloadRequest =>
    ({
      payload: {
        config: {
          localization: {
            defaultLocale: 'en',
            localeCodes: ['en', 'es', 'ja'],
          },
        },
        findByID: vi.fn().mockResolvedValue({ title: 'Hello world' }),
        update: vi.fn().mockResolvedValue({}),
        ...overrides,
      },
      routeParams: { id: '1' },
      user: { id: 1 },
    }) as unknown as PayloadRequest;

  const endpoint = createTranslateEndpoint({
    fields: ['title'],
    slug: 'posts',
  });

  it('keeps completed locale reports when a later locale throws', async () => {
    const update = vi.fn().mockResolvedValue({});
    const req = makeReq({ update });
    translateMany
      .mockResolvedValueOnce([
        {
          dataFormat: 'STRING',
          locale: 'es',
          success: true,
          translation: 'Hola mundo',
        },
      ])
      .mockRejectedValueOnce(new Error('network down'));

    const response = await endpoint.handler(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.locales.es).toEqual({
      failed: [],
      partial: [],
      translated: ['title'],
    });
    expect(body.locales.ja).toEqual({
      error: 'network down',
      failed: [],
      partial: [],
      translated: [],
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Hola mundo' }, locale: 'es' })
    );
  });

  it('returns 502 with no writes when the source read fails', async () => {
    const update = vi.fn();
    const req = makeReq({
      findByID: vi.fn().mockRejectedValue(new Error('not found')),
      update,
    });

    const response = await endpoint.handler(req);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: 'not found' });
    expect(update).not.toHaveBeenCalled();
  });
});
