import { Schema } from '@sanity/schema';
import type { SanityClient, SanityDocument } from 'sanity';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import { hasLocaleContent } from '../../serialization/internationalizedArray/detect';
import type { TranslationFunctionContext } from '../../types';
import { collectExistingTranslations } from '../collectExistingTranslations';

// Minimal stand-ins for the types sanity-plugin-internationalized-array
// registers: an array of `{ _key, _type, language, value }` objects.
const internationalizedArrayType = (fieldType: 'string' | 'text') => {
  const capitalized = fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
  const valueTypeName = `internationalizedArray${capitalized}Value`;
  return [
    {
      name: valueTypeName,
      type: 'object',
      fields: [
        { name: 'language', type: 'string' },
        { name: 'value', type: fieldType },
      ],
    },
    {
      name: `internationalizedArray${capitalized}`,
      type: 'array',
      of: [{ type: valueTypeName }],
    },
  ];
};

const postType = {
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'internationalizedArrayString' },
    {
      name: 'description',
      title: 'Description',
      type: 'internationalizedArrayText',
    },
  ],
};

const pageType = {
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [{ name: 'title', title: 'Title', type: 'string' }],
};

const schema: InstanceType<typeof Schema> = new Schema({
  name: 'test',
  types: [
    ...internationalizedArrayType('string'),
    ...internationalizedArrayType('text'),
    postType,
    pageType,
  ] as never,
});

const item = (type: string, language: string, value: unknown) => ({
  _key: `key-${language}`,
  _type: type,
  language,
  value,
});

const contextWith = (client: Partial<SanityClient>) =>
  ({ client, schema }) as unknown as TranslationFunctionContext;

afterEach(() => {
  pluginConfig.translationLevel = 'document';
  pluginConfig.fieldLevelDocuments = [];
  pluginConfig.sourceLocale = 'en';
});

describe('hasLocaleContent', () => {
  const field = [
    item('internationalizedArrayStringValue', 'en', 'Hello'),
    item('internationalizedArrayStringValue', 'es', 'Hola'),
  ];

  test('detects a locale item on a top-level field', () => {
    expect(hasLocaleContent({ title: field }, 'es')).toBe(true);
    expect(hasLocaleContent({ title: field }, 'fr')).toBe(false);
  });

  test('detects a locale item nested in objects and arrays', () => {
    const doc = { sections: [{ heading: { inner: field } }] };
    expect(hasLocaleContent(doc, 'es')).toBe(true);
    expect(hasLocaleContent(doc, 'fr')).toBe(false);
  });

  test('returns false for documents without internationalized arrays', () => {
    expect(hasLocaleContent({ title: 'Hello', tags: ['a'] }, 'es')).toBe(false);
  });
});

describe('collectExistingTranslations (internationalized array)', () => {
  test('collapses each locale with content and skips locales without', async () => {
    pluginConfig.translationLevel = 'internationalizedArray';
    pluginConfig.sourceLocale = 'en';

    const doc = {
      _id: 'drafts.post-1',
      _type: 'post',
      _rev: 'rev-1',
      title: [
        item('internationalizedArrayStringValue', 'en', 'Hello'),
        item('internationalizedArrayStringValue', 'es', 'Hola'),
      ],
      description: [
        item('internationalizedArrayTextValue', 'en', 'A description'),
      ],
    } as unknown as SanityDocument;

    const fetchMock = vi.fn();
    const existing = await collectExistingTranslations(
      [doc],
      ['es', 'fr'],
      contextWith({ fetch: fetchMock as SanityClient['fetch'] })
    );

    // Translations live in the document itself, so no queries are needed.
    expect(fetchMock).not.toHaveBeenCalled();

    const translations = existing.get('post-1');
    expect(translations).toHaveLength(1);
    expect(translations?.[0].locale).toBe('es');
    expect(translations?.[0].content).toContain('Hola');
    expect(translations?.[0].content).not.toContain('Hello');
    expect(existing.size).toBe(1);
  });

  test('omits documents with no target-locale content', async () => {
    pluginConfig.translationLevel = 'internationalizedArray';

    const doc = {
      _id: 'post-2',
      _type: 'post',
      _rev: 'rev-1',
      title: [item('internationalizedArrayStringValue', 'en', 'Hello')],
    } as unknown as SanityDocument;

    const existing = await collectExistingTranslations(
      [doc],
      ['es'],
      contextWith({ fetch: vi.fn() as SanityClient['fetch'] })
    );

    expect(existing.size).toBe(0);
  });
});

describe('collectExistingTranslations (document level)', () => {
  const sourceDoc = {
    _id: 'page-1',
    _type: 'page',
    _rev: 'rev-1',
    title: 'Hello',
  } as unknown as SanityDocument;

  test('serializes the linked translated documents, preferring drafts', async () => {
    const fetchMock = vi
      .fn()
      // translation.metadata rows
      .mockResolvedValueOnce([
        {
          sourceDocId: 'page-1',
          translations: [{ language: 'es', docId: 'page-1-es' }],
        },
      ])
      // translated documents: published and draft versions
      .mockResolvedValueOnce([
        {
          _id: 'page-1-es',
          _type: 'page',
          _rev: 'rev-es-1',
          language: 'es',
          title: 'Hola publicado',
        },
        {
          _id: 'drafts.page-1-es',
          _type: 'page',
          _rev: 'rev-es-2',
          language: 'es',
          title: 'Hola borrador',
        },
      ]);

    const existing = await collectExistingTranslations(
      [sourceDoc],
      ['es'],
      contextWith({ fetch: fetchMock as SanityClient['fetch'] })
    );

    const translations = existing.get('page-1');
    expect(translations).toHaveLength(1);
    expect(translations?.[0].locale).toBe('es');
    expect(translations?.[0].content).toContain('Hola borrador');
    expect(translations?.[0].content).not.toContain('Hola publicado');
  });

  test('returns nothing when no translated documents are linked', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce([]);

    const existing = await collectExistingTranslations(
      [sourceDoc],
      ['es'],
      contextWith({ fetch: fetchMock as SanityClient['fetch'] })
    );

    expect(existing.size).toBe(0);
    // Only the metadata query runs; there are no documents to fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('never uploads the source locale even if requested', async () => {
    const fetchMock = vi.fn();

    const existing = await collectExistingTranslations(
      [sourceDoc],
      ['en'],
      contextWith({ fetch: fetchMock as SanityClient['fetch'] })
    );

    expect(existing.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
