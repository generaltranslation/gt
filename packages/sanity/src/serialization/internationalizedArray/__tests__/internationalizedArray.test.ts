// @vitest-environment jsdom

import { Schema } from '@sanity/schema';
import { SanityDocument } from 'sanity';
import { describe, expect, test } from 'vitest';
import {
  deserializeDocument,
  serializeDocument,
} from '../../../utils/serialize';
import {
  findLocaleItem,
  isInternationalizedArrayField,
  isInternationalizedArrayItem,
} from '../detect';
import { collapseToSourceLocale } from '../collapse';
import { mergeInternationalizedArrays } from '../merge';

const stringItem = (language: string, value: string) => ({
  _key: `key-${language}`,
  _type: 'internationalizedArrayStringValue',
  language,
  value,
});

describe('detect', () => {
  test('recognises an internationalized array item by shape', () => {
    expect(isInternationalizedArrayItem(stringItem('en', 'Hello'))).toBe(true);
  });

  test('rejects plain objects and ordinary array entries', () => {
    expect(isInternationalizedArrayItem({ _type: 'block', children: [] })).toBe(
      false
    );
    expect(isInternationalizedArrayItem({ language: 'en', value: 'x' })).toBe(
      false
    );
  });

  test('rejects user-defined *Value types that only share the shape', () => {
    expect(
      isInternationalizedArrayItem({
        _key: 'k',
        _type: 'priceValue',
        language: 'USD',
        value: 9.99,
      })
    ).toBe(false);
  });

  test('rejects items whose _type lacks the internationalizedArray prefix', () => {
    expect(
      isInternationalizedArrayItem({
        _key: 'k',
        _type: 'myI18nStringValue',
        language: 'en',
        value: 'Hello',
      })
    ).toBe(false);
  });

  test('recognises a full internationalized array field', () => {
    const field = [stringItem('en', 'Hello'), stringItem('es', 'Hola')];
    expect(isInternationalizedArrayField(field)).toBe(true);
  });

  test('a mixed/ordinary array is not an internationalized array field', () => {
    expect(isInternationalizedArrayField([{ _type: 'block' }])).toBe(false);
    expect(isInternationalizedArrayField([])).toBe(false);
  });

  test('findLocaleItem matches on exact language id, not _key', () => {
    const field = [stringItem('en', 'Hello'), stringItem('fr-CA', 'Bonjour')];
    expect(findLocaleItem(field, 'fr-CA')?.value).toBe('Bonjour');
    expect(findLocaleItem(field, 'key-en')).toBeUndefined();
  });
});

describe('collapseToSourceLocale', () => {
  test('exports only the source-locale value for a string field', () => {
    const doc = {
      _id: 'a',
      _type: 'post',
      title: [stringItem('en', 'Hello'), stringItem('es', 'Hola')],
    };
    expect(collapseToSourceLocale(doc, 'en')).toEqual({
      _id: 'a',
      _type: 'post',
      title: 'Hello',
    });
  });

  test('skips a field with no source-locale item', () => {
    const doc = {
      _type: 'post',
      title: [stringItem('es', 'Hola'), stringItem('fr', 'Bonjour')],
    };
    expect(collapseToSourceLocale(doc, 'en')).toEqual({ _type: 'post' });
  });

  test('handles hyphenated source locale ids', () => {
    const doc = {
      _type: 'post',
      title: [stringItem('en-US', 'Hello'), stringItem('es', 'Hola')],
    };
    expect(collapseToSourceLocale(doc, 'en-US')).toEqual({
      _type: 'post',
      title: 'Hello',
    });
  });

  test('preserves Portable Text source values', () => {
    const blocks = [{ _type: 'block', _key: 'b1', children: [] }];
    const doc = {
      _type: 'post',
      body: [
        {
          _key: 'k',
          _type: 'internationalizedArrayBlockValue',
          language: 'en',
          value: blocks,
        },
      ],
    };
    expect(collapseToSourceLocale(doc, 'en')).toEqual({
      _type: 'post',
      body: blocks,
    });
  });

  test('leaves ordinary (non-localized) arrays untouched', () => {
    const doc = { _type: 'post', tags: ['a', 'b'] };
    expect(collapseToSourceLocale(doc, 'en')).toEqual(doc);
  });

  test('handles an internationalized array field nested inside an object', () => {
    const doc = {
      _type: 'post',
      seo: {
        _type: 'seo',
        heading: [stringItem('en', 'Hi'), stringItem('es', 'Hola')],
      },
    };
    expect(collapseToSourceLocale(doc, 'en')).toEqual({
      _type: 'post',
      seo: { _type: 'seo', heading: 'Hi' },
    });
  });
});

describe('mergeInternationalizedArrays', () => {
  test('updates an existing target-locale item, preserving its _key', () => {
    const baseDoc = {
      _id: 'a',
      _type: 'post',
      title: [stringItem('en', 'Hello'), stringItem('es', 'OLD')],
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'Hola' },
      'es',
      'en'
    );
    expect(changes.title).toEqual([
      stringItem('en', 'Hello'),
      stringItem('es', 'Hola'),
    ]);
  });

  test('inserts a missing target-locale item with a fresh random _key', () => {
    const baseDoc = {
      _type: 'post',
      title: [stringItem('en', 'Hello')],
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'Bonjour' },
      'fr',
      'en'
    );
    const title = changes.title as Array<Record<string, unknown>>;
    expect(title).toHaveLength(2);
    const inserted = title[1];
    expect(inserted.language).toBe('fr');
    expect(inserted.value).toBe('Bonjour');
    expect(inserted._type).toBe('internationalizedArrayStringValue');
    expect(typeof inserted._key).toBe('string');
    expect(inserted._key).not.toBe('key-en');
  });

  test('preserves the source-locale item', () => {
    const baseDoc = {
      _type: 'post',
      title: [stringItem('en', 'Hello')],
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'Hola' },
      'es',
      'en'
    );
    const title = changes.title as Array<Record<string, unknown>>;
    expect(title.find((i) => i.language === 'en')?.value).toBe('Hello');
  });

  test('leaves non-translatable sibling fields out of the patch', () => {
    const baseDoc = {
      _type: 'post',
      title: [stringItem('en', 'Hello')],
      slug: { current: 'hello' },
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'Hola', slug: { current: 'hola' } },
      'es',
      'en'
    );
    expect(Object.keys(changes)).toEqual(['title']);
  });

  test('handles hyphenated target locale ids', () => {
    const baseDoc = {
      _type: 'post',
      title: [stringItem('en', 'Hello')],
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'Bonjour' },
      'fr-CA',
      'en'
    );
    const title = changes.title as Array<Record<string, unknown>>;
    expect(title.find((i) => i.language === 'fr-CA')?.value).toBe('Bonjour');
  });

  test('upserts an internationalized array nested inside an object field', () => {
    const baseDoc = {
      _type: 'post',
      seo: {
        _type: 'seo',
        _key: undefined,
        heading: [stringItem('en', 'Hi')],
      },
    };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', seo: { _type: 'seo', heading: 'Hola' } },
      'es',
      'en'
    );
    const seo = changes.seo as { heading: Array<Record<string, unknown>> };
    expect(seo.heading.find((i) => i.language === 'es')?.value).toBe('Hola');
    expect(seo.heading.find((i) => i.language === 'en')?.value).toBe('Hi');
  });

  test('returns no changes when there is no localized content', () => {
    const baseDoc = { _type: 'post', title: 'plain' };
    const changes = mergeInternationalizedArrays(
      baseDoc,
      { _type: 'post', title: 'plain-es' },
      'es',
      'en'
    );
    expect(changes).toEqual({});
  });
});

describe('internationalized array serialize round-trip', () => {
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

  const generatedTypes = [
    ...internationalizedArrayType('string'),
    ...internationalizedArrayType('text'),
  ];

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
      { name: 'tags', title: 'Tags', type: 'array', of: [{ type: 'string' }] },
    ],
  };

  const schema: InstanceType<typeof Schema> = new Schema({
    name: 'test',
    types: [...generatedTypes, postType] as never,
  });

  const item = (type: string, language: string, value: unknown) => ({
    _key: `key-${language}`,
    _type: type,
    language,
    value,
  });

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
    tags: ['alpha', 'beta'],
  } as unknown as SanityDocument;

  const serialized = serializeDocument(
    doc,
    schema,
    'en',
    'internationalizedArray'
  );

  test('exports only the source-locale value', () => {
    expect(serialized.content).toContain('Hello');
    expect(serialized.content).not.toContain('Hola');
  });

  test('carries the document _type so import can pick the strategy', () => {
    expect(serialized.content).toContain('content="post"');
  });

  test('round-trips source values back through the deserializer', () => {
    const deserialized = deserializeDocument(serialized.content);
    expect(deserialized.title).toBe('Hello');
    expect(deserialized.description).toBe('A description');
    expect(deserialized._type).toBe('post');
  });

  test('passes non-localized arrays through unchanged', () => {
    const deserialized = deserializeDocument(serialized.content);
    expect(deserialized.tags).toEqual(['alpha', 'beta']);
  });
});
