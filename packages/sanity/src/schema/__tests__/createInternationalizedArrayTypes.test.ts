import { describe, expect, test } from 'vitest';
import { createInternationalizedArrayTypes } from '../createInternationalizedArrayTypes';

type GeneratedArrayType = {
  name: string;
  type: string;
  components?: { input?: unknown; field?: unknown };
  of: Array<{
    name: string;
    type: string;
    components?: { item?: unknown };
    fields: Array<{
      name: string;
      type: string;
      readOnly?: boolean;
      hidden?: boolean;
    }>;
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

  describe('components option', () => {
    test('attaches GT components by default and hides the language field', () => {
      const [type] = generate({ fieldTypes: ['string'] });
      expect(typeof type.components?.input).toBe('function');
      expect(typeof type.components?.field).toBe('function');
      expect(typeof type.of[0].components?.item).toBe('function');
      const languageField = type.of[0].fields.find(
        (f) => f.name === 'language'
      );
      expect(languageField?.hidden).toBe(true);
    });

    test('replaces slots with custom components', () => {
      const CustomInput = () => null;
      const CustomItem = () => null;
      const [type] = generate({
        fieldTypes: ['string'],
        components: { input: CustomInput, item: CustomItem },
      });
      expect(type.components?.input).toBe(CustomInput);
      expect(type.of[0].components?.item).toBe(CustomItem);
    });

    test('detaches components when set to false', () => {
      const [type] = generate({
        fieldTypes: ['string'],
        components: { input: false, item: false, field: false },
      });
      expect(type.components).toBeUndefined();
      expect(type.of[0].components).toBeUndefined();
    });

    test('field level-reset default follows the input slot', () => {
      const [detached] = generate({
        fieldTypes: ['string'],
        components: { input: false },
      });
      expect(detached.components?.field).toBeUndefined();

      const CustomInput = () => null;
      const [custom] = generate({
        fieldTypes: ['string'],
        components: { input: CustomInput },
      });
      expect(custom.components?.field).toBeUndefined();
      expect(custom.components?.input).toBe(CustomInput);
    });

    test('keeps the language field visible with a custom or detached item', () => {
      const [type] = generate({
        fieldTypes: ['string'],
        components: { item: false },
      });
      const languageField = type.of[0].fields.find(
        (f) => f.name === 'language'
      );
      expect(languageField?.hidden).toBe(false);
      expect(languageField?.readOnly).toBe(true);
    });
  });
});
