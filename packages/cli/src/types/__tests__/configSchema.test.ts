import fs from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import {
  configJsonSchemaPath,
  generateConfigJsonSchema,
} from '../../../scripts/generate-config-schema.js';
import {
  GTConfigFileSchema,
  GTConfigFileSchemaDefinitions,
} from '../../config/schema.js';

const schema = JSON.parse(fs.readFileSync(configJsonSchemaPath, 'utf8'));
const validate = new Ajv({ strict: false, validateFormats: false }).compile(
  schema
);

describe('GT config JSON Schema', () => {
  it('matches the schema generated from GTConfigFileSchema', () => {
    expect(
      generateConfigJsonSchema(
        GTConfigFileSchema,
        GTConfigFileSchemaDefinitions
      )
    ).toEqual(schema);
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
  ])('accepts %s', (_name, config) => {
    expect(validate(config), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([
    ['an unknown key', { unknownKey: true }],
    ['an apiKey', { apiKey: 'secret' }],
    ['a lowercase model provider', { modelProvider: 'openai' }],
    ['an unknown file type', { files: { docx: { include: ['a'] } } }],
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
