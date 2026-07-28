import { Schema } from '@sanity/schema';
import { SanityDocument } from 'sanity';
import { describe, expect, test } from 'vitest';
import {
  deserializeDocument,
  serializeDocument,
} from '../../../utils/serialize';

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
  description: [item('internationalizedArrayTextValue', 'en', 'A description')],
  tags: ['alpha', 'beta'],
} as unknown as SanityDocument;

describe('internationalized array serialize round-trip', () => {
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
