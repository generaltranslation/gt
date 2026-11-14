import fs from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { configJsonSchemaPath } from '../../../scripts/generate-config-schema.js';
import { GT_CONFIG_SCHEMA_URL } from '../../utils/constants.js';

const compileSchema = (path: string | URL) =>
  new Ajv({ strict: false, validateFormats: false }).compile(
    JSON.parse(fs.readFileSync(path, 'utf8'))
  );
const validate = compileSchema(configJsonSchemaPath);
const validateFor = (packageDirectory: string) =>
  compileSchema(
    new URL(
      `../../../../${packageDirectory}/config-schema.json`,
      import.meta.url
    )
  );

describe('GT config JSON Schema', () => {
  it('is published at GT_CONFIG_SCHEMA_URL', () => {
    expect(JSON.parse(fs.readFileSync(configJsonSchemaPath, 'utf8')).$id).toBe(
      GT_CONFIG_SCHEMA_URL
    );
  });

  it.each([
    ['an empty config', {}],
    ['files.html', { files: { html: { include: ['[locale]/*.html'] } } }],
    ['an uppercase file type alias', { files: { POT: { include: ['a'] } } }],
    ['files.gt.publish', { files: { gt: { publish: true } } }],
    ['options.excludeStaticUrls', { options: { excludeStaticUrls: ['a'] } }],
    ['runtimeUrl null', { runtimeUrl: null }],
    ['framework mintlify', { framework: 'mintlify' }],
    ['an API model provider', { modelProvider: 'OPENAI' }],
    [
      'a JSON preset without include',
      { options: { jsonSchema: { '*.json': { preset: 'mintlify' } } } },
    ],
    [
      'JSON include alone',
      { options: { jsonSchema: { '*.json': { include: ['$.a'] } } } },
    ],
    [
      'JSON composite alone',
      {
        options: {
          jsonSchema: {
            '*.json': {
              composite: { '$.l': { type: 'array', include: ['$.t'] } },
            },
          },
        },
      },
    ],
    [
      'a JSON preset with include',
      {
        options: {
          jsonSchema: { '*.json': { preset: 'openapi', include: ['$.a'] } },
        },
      },
    ],
    ['skipVersionCheck', { skipVersionCheck: true }],
    [
      'an uppercase transformationFormat',
      { files: { json: { include: ['a'], transformationFormat: 'PO' } } },
    ],
    [
      'a lowercase transformationFormat',
      { files: { json: { include: ['a'], transformationFormat: 'po' } } },
    ],
  ])('accepts %s', (_name, config) => {
    expect(validate(config), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([
    ['an unknown key', { unknownKey: true }],
    ['an apiKey', { apiKey: 'secret' }],
    ['a lowercase model provider', { modelProvider: 'openai' }],
    ['an unknown file type', { files: { docx: { include: ['a'] } } }],
    [
      'JSON include with composite',
      {
        options: {
          jsonSchema: {
            '*.json': {
              include: ['$.a'],
              composite: { '$.l': { type: 'array', include: ['$.t'] } },
            },
          },
        },
      },
    ],
    [
      'JSON options without include, composite or preset',
      { options: { jsonSchema: { '*.json': {} } } },
    ],
    [
      'an unknown transformationFormat',
      { files: { json: { include: ['a'], transformationFormat: 'bogus' } } },
    ],
  ])('rejects %s', (_name, config) => {
    expect(validate(config)).toBe(false);
  });
});

describe('GT config schema parsing flags', () => {
  it('validates Vue options alongside the React flags', () => {
    const withParsingFlags = (parsingFlags: unknown) => ({
      files: { gt: { parsingFlags } },
    });

    expect(
      validate(
        withParsingFlags({
          autoderive: { jsx: true },
          devHotReload: { strings: true },
          vueCompilerOptions: { whitespace: 'preserve' },
        })
      )
    ).toBe(true);
    expect(
      validate(
        withParsingFlags({
          devHotReload: true,
          vueCompilerOptions: { unsupportedVueOption: true },
        })
      )
    ).toBe(false);
    expect(validate(withParsingFlags({ viteConfigPath: ' ' }))).toBe(false);
  });
});

describe('GT config schema static url options', () => {
  it('accepts the boolean and object forms of experimentalLocalizeStaticUrls', () => {
    const withOption = (experimentalLocalizeStaticUrls: unknown) => ({
      options: { experimentalLocalizeStaticUrls },
    });

    expect(validate(withOption(true))).toBe(true);
    expect(validate(withOption({ skipUntranslatedPages: true }))).toBe(true);
    expect(validate(withOption({ attributes: ['href*'] }))).toBe(true);
    expect(validate(withOption({ unknownOption: true }))).toBe(false);
  });

  it('accepts docsUrlPattern as one pattern or a list', () => {
    const withPattern = (docsUrlPattern: unknown) => ({
      options: { docsUrlPattern },
    });

    expect(validate(withPattern('/docs/[locale]'))).toBe(true);
    expect(validate(withPattern(['/docs/[locale]', '/ai/docs/[locale]']))).toBe(
      true
    );
    expect(validate(withPattern([]))).toBe(false);
    expect(validate(withPattern([1]))).toBe(false);
  });
});

describe('library config JSON Schemas', () => {
  const routing = {
    locales: ['fr'],
    prefixDefaultLocale: true,
    pathConfig: { '/about': { fr: '/a-propos' } },
  };

  it("accept gt-next's routing keys only in gt-next's schema", () => {
    expect(validateFor('next')(routing)).toBe(true);
    expect(validateFor('react')(routing)).toBe(false);
    expect(validate(routing)).toBe(false);
  });

  it('accept the CLI keys in every library schema', () => {
    const config = { locales: ['fr'], files: { gt: { publish: true } } };
    for (const directory of ['next', 'react', 'tanstack-start', 'vue']) {
      expect(validateFor(directory)(config)).toBe(true);
    }
  });
});
