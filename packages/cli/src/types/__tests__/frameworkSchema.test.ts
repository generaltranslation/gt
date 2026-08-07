import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const schema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../assets/config-schema.json'),
    'utf8'
  )
) as Record<string, unknown>;
const validateConfig = new Ajv({
  allErrors: true,
  formats: { uri: true },
  strict: false,
}).compile(schema);

describe('config schema', () => {
  it('accepts every Vue framework emitted by setup', () => {
    const frameworkSchema = schema as {
      properties: { framework: { enum: string[] } };
    };

    expect(frameworkSchema.properties.framework.enum).toEqual(
      expect.arrayContaining(['vite-vue', 'nuxt'])
    );
  });

  it('accepts the documented Vue Vite config path', () => {
    expectValidConfig({
      defaultLocale: 'en',
      locales: ['fr'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
          parsingFlags: {
            viteConfigPath: 'config/vite.custom.ts',
          },
        },
      },
    });
  });

  it('accepts shared and Vue-specific GT parsing flags', () => {
    expectValidConfig({
      defaultLocale: 'en',
      locales: ['fr'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
          parsingFlags: {
            autoderive: { jsx: true, strings: false },
            devHotReload: { jsx: false, strings: true },
            enableAutoJsxInjection: true,
            includeSourceCodeContext: true,
            legacyGtReactImportSource: false,
            viteConfigPath: 'vite.config.ts',
            vueCompilerOptions: {
              delimiters: ['[[', ']]'],
              whitespace: 'preserve',
            },
          },
        },
      },
    });
  });

  it('rejects Vue delimiter pairs that extraction cannot use', () => {
    expectInvalidConfig({
      defaultLocale: 'en',
      locales: ['fr'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
          parsingFlags: {
            vueCompilerOptions: {
              delimiters: ['', ']]'],
            },
          },
        },
      },
    });
  });

  it('rejects a blank Vue Vite config path', () => {
    expectInvalidConfig({
      defaultLocale: 'en',
      locales: ['fr'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
          parsingFlags: {
            viteConfigPath: '   ',
          },
        },
      },
    });
  });
});

function expectValidConfig(config: unknown): void {
  const valid = validateConfig(config);
  expect(validateConfig.errors).toBeNull();
  expect(valid).toBe(true);
}

function expectInvalidConfig(config: unknown): void {
  expect(validateConfig(config)).toBe(false);
  expect(validateConfig.errors).not.toBeNull();
}
