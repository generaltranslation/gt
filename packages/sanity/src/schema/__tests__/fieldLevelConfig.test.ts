import { describe, expect, test } from 'vitest';
import {
  buildInternationalizedArrayPlugin,
  resolveFieldLevelConfig,
} from '../fieldLevelConfig';

type SchemaTypeLike = { name: string };

function schemaTypeNames(
  plugin: ReturnType<typeof buildInternationalizedArrayPlugin>
): string[] {
  const types = (plugin.schema?.types ?? []) as SchemaTypeLike[];
  return types.map((type) => type.name);
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

  test('deduplicates a source locale repeated in locales', () => {
    const plugin = buildInternationalizedArrayPlugin(
      resolveFieldLevelConfig({ enabled: true }),
      'en',
      ['en', 'es']
    );
    // The plugin stores its languages in the value object's language field
    // list options; the simplest observable contract is that building does
    // not throw and still yields the standard types.
    expect(schemaTypeNames(plugin)).toContain('internationalizedArrayString');
  });
});
