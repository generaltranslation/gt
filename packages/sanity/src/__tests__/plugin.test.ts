import { defineField } from 'sanity';
import { describe, expect, test } from 'vitest';
import { gtPlugin } from '../index';
import { pluginConfig } from '../adapter/core';
import {
  buildInternationalizedArrayPlugin,
  resolveFieldLevelConfig,
} from '../schema/fieldLevelConfig';
import '../schema/schemaOptions';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';

// These suites all need the real `sanity` package, which takes about a second
// to load, so they share one file.

const configure = (options: Partial<Parameters<typeof gtPlugin>[0]> = {}) =>
  gtPlugin({
    locales: ['fr'],
    sourceLocale: 'en',
    showDocumentInternationalization: false,
    ...options,
  });

describe('allowNonDefaultSourceLocales', () => {
  test('is off by default', () => {
    configure();
    expect(pluginConfig.getAllowNonDefaultSourceLocales()).toBe(false);
    expect(allowsNonDefaultSourceLocales()).toBe(false);
  });

  test('is on only when set to true', () => {
    configure({ allowNonDefaultSourceLocales: true });
    expect(allowsNonDefaultSourceLocales()).toBe(true);

    configure({ allowNonDefaultSourceLocales: false });
    expect(allowsNonDefaultSourceLocales()).toBe(false);
  });
});

test('options.gt.exclude is accepted by defineField', () => {
  // Compile-time check: the module augmentation must make `options.gt`
  // type-check on ordinary field definitions.
  const field = defineField({
    name: 'internalNotes',
    type: 'string',
    options: { gt: { exclude: true } },
  });

  expect((field.options as { gt?: { exclude?: boolean } }).gt?.exclude).toBe(
    true
  );
});

type SchemaTypeLike = {
  name: string;
  options?: { languages?: { id: string; title: string }[] };
};

function schemaTypeNames(
  plugin: ReturnType<typeof buildInternationalizedArrayPlugin>
): string[] {
  const types = (plugin.schema?.types ?? []) as SchemaTypeLike[];
  return types.map((type) => type.name);
}

function languageOptions(
  plugin: ReturnType<typeof buildInternationalizedArrayPlugin>
): { id: string; title: string }[] {
  const types = (plugin.schema?.types ?? []) as SchemaTypeLike[];
  const arrayType = types.find(
    (type) => type.name === 'internationalizedArrayString'
  );
  return arrayType?.options?.languages ?? [];
}

describe('resolveFieldLevelConfig', () => {
  test('defaults to disabled with string/text field types', () => {
    const resolved = resolveFieldLevelConfig(undefined);
    expect(resolved.enabled).toBe(false);
    expect(resolved.fieldTypes).toEqual(['string', 'text']);
  });
});

describe('buildInternationalizedArrayPlugin', () => {
  test('configures the reference plugin', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true }),
      'en',
      ['es', 'fr']
    );
    expect(plugin.name).toBe('sanity-plugin-internationalized-array');
  });

  test('registers the standard internationalizedArray* types', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true }),
      'en',
      ['es']
    );
    const names = schemaTypeNames(plugin);
    expect(names).toContain('internationalizedArrayString');
    expect(names).toContain('internationalizedArrayStringValue');
    expect(names).toContain('internationalizedArrayText');
    expect(names).toContain('internationalizedArrayTextValue');
  });

  test("maps the 'block' shortcut to a Portable Text array type", () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true, fieldTypes: ['block'] }),
      'en',
      ['es']
    );
    const names = schemaTypeNames(plugin);
    expect(names).toContain('internationalizedArrayBlock');
    expect(names).toContain('internationalizedArrayBlockValue');
  });

  test('applies customMapping to language titles', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true }),
      'en',
      ['zh-TW'],
      { 'zh-TW': 'Traditional Chinese' }
    );
    expect(languageOptions(plugin)).toEqual([
      { id: 'en', title: '🇺🇸 English (en)' },
      // A string customMapping is the user's full label — no flag or code added.
      { id: 'zh-TW', title: 'Traditional Chinese' },
    ]);
  });

  test('languageTitles and getLanguageTitle take precedence over customMapping', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({
        enabled: true,
        languageTitles: { 'zh-TW': 'From languageTitles' },
        getLanguageTitle: (locale) =>
          locale === 'es' ? 'From getLanguageTitle' : undefined!,
      }),
      'en',
      ['zh-TW', 'es'],
      { 'zh-TW': 'From customMapping', es: 'From customMapping' }
    );
    expect(languageOptions(plugin)).toEqual([
      { id: 'en', title: '🇺🇸 English (en)' },
      { id: 'zh-TW', title: 'From languageTitles' },
      { id: 'es', title: 'From getLanguageTitle' },
    ]);
  });

  test('deduplicates a source locale repeated in locales', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true }),
      'en',
      ['en', 'es']
    );
    expect(languageOptions(plugin).map((language) => language.id)).toEqual([
      'en',
      'es',
    ]);
  });
});
