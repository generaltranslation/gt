import { describe, expect, test } from 'vitest';
import { createInternationalizedArrayTypes } from '../createInternationalizedArrayTypes';

type GeneratedArrayType = {
  name: string;
  type: string;
  of: Array<{
    name: string;
    type: string;
    fields: Array<{ name: string; type: string; readOnly?: boolean }>;
  }>;
};

const generate = (
  overrides: Partial<Parameters<typeof createInternationalizedArrayTypes>[0]>
) =>
  createInternationalizedArrayTypes({
    sourceLocale: 'en',
    locales: ['es', 'fr'],
    fieldTypes: ['string', 'text'],
    ...overrides,
  }) as unknown as GeneratedArrayType[];

describe('createInternationalizedArrayTypes', () => {
  test('generates internationalizedArrayString', () => {
    const types = generate({ fieldTypes: ['string'] });
    const stringType = types.find(
      (t) => t.name === 'internationalizedArrayString'
    );
    expect(stringType).toBeDefined();
    expect(stringType?.type).toBe('array');
    const valueObject = stringType?.of[0];
    expect(valueObject?.name).toBe('internationalizedArrayStringValue');
    const valueField = valueObject?.fields.find((f) => f.name === 'value');
    expect(valueField?.type).toBe('string');
  });

  test('generates internationalizedArrayText with a text value field', () => {
    const types = generate({ fieldTypes: ['text'] });
    const textType = types.find((t) => t.name === 'internationalizedArrayText');
    const valueField = textType?.of[0].fields.find((f) => f.name === 'value');
    expect(valueField?.type).toBe('text');
  });

  test('the language field is read-only', () => {
    const types = generate({ fieldTypes: ['string'] });
    const languageField = types[0].of[0].fields.find(
      (f) => f.name === 'language'
    );
    expect(languageField?.readOnly).toBe(true);
  });

  test('generates a Portable Text (block) value field', () => {
    const types = generate({ fieldTypes: ['block'] });
    const blockType = types.find(
      (t) => t.name === 'internationalizedArrayBlock'
    );
    const valueField = blockType?.of[0].fields.find(
      (f) => f.name === 'value'
    ) as { type: string; of: Array<{ type: string }> } | undefined;
    expect(valueField?.type).toBe('array');
    expect(valueField?.of[0].type).toBe('block');
  });

  test('supports custom field types', () => {
    const types = generate({
      fieldTypes: [{ name: 'seo', type: 'seoObject' }],
    });
    const seoType = types.find((t) => t.name === 'internationalizedArraySeo');
    expect(seoType).toBeDefined();
    expect(seoType?.of[0].name).toBe('internationalizedArraySeoValue');
    const valueField = seoType?.of[0].fields.find((f) => f.name === 'value');
    expect(valueField?.type).toBe('seoObject');
  });

  test('generates compatibility aliases when a custom prefix is used', () => {
    const types = generate({
      fieldTypes: ['string'],
      typePrefix: 'gtArray',
      includeCompatibilityTypes: true,
    });
    expect(types.find((t) => t.name === 'gtArrayString')).toBeDefined();
    expect(
      types.find((t) => t.name === 'internationalizedArrayString')
    ).toBeDefined();
  });

  test('does not duplicate types when prefix is the default', () => {
    const names = generate({ fieldTypes: ['string'] }).map((t) => t.name);
    expect(names).toEqual(['internationalizedArrayString']);
  });

  test('omits compatibility aliases when disabled', () => {
    const names = generate({
      fieldTypes: ['string'],
      typePrefix: 'gtArray',
      includeCompatibilityTypes: false,
    }).map((t) => t.name);
    expect(names).toEqual(['gtArrayString']);
  });
});
