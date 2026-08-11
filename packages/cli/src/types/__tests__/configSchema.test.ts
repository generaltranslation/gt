import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

type JsonSchema = {
  additionalItems?: boolean;
  additionalProperties?: boolean;
  enum?: unknown[];
  items?: JsonSchema[];
  maxItems?: number;
  minItems?: number;
  oneOf?: JsonSchema[];
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  type?: string;
};

const schemaPath = fileURLToPath(
  new URL('../../../../../assets/config-schema.json', import.meta.url)
);
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as JsonSchema;

function getParsingFlagProperties(): Record<string, JsonSchema> {
  const parsingFlagProperties = getParsingFlagsSchema().properties;

  expect(parsingFlagProperties).toBeDefined();
  return parsingFlagProperties ?? {};
}

function getParsingFlagsSchema(): JsonSchema {
  const parsingFlagsSchema =
    schema.properties?.files?.properties?.gt?.properties?.parsingFlags;

  expect(parsingFlagsSchema).toBeDefined();
  return parsingFlagsSchema ?? {};
}

describe('GT config schema parsing flags', () => {
  it('adds only the Vue parsing flag surface', () => {
    expect(Object.keys(getParsingFlagProperties()).sort()).toEqual([
      'viteConfigPath',
      'vueCompilerOptions',
    ]);
  });

  it('validates Vue options without rejecting existing React flags', () => {
    const validate = new Ajv({ strict: false }).compile(
      getParsingFlagsSchema()
    );

    expect(
      validate({
        autoderive: { jsx: true },
        devHotReload: { strings: true },
        vueCompilerOptions: { whitespace: 'preserve' },
      })
    ).toBe(true);
    expect(
      validate({
        devHotReload: true,
        vueCompilerOptions: { unsupportedVueOption: true },
      })
    ).toBe(false);
  });

  it('matches the exact Vue compiler option contract', () => {
    expect(getParsingFlagProperties().vueCompilerOptions).toEqual({
      type: 'object',
      description: 'Hash-affecting Vue template compiler options',
      properties: {
        whitespace: {
          type: 'string',
          enum: ['condense', 'preserve'],
        },
        delimiters: {
          type: 'array',
          items: [
            { type: 'string', minLength: 1 },
            { type: 'string', minLength: 1 },
          ],
          additionalItems: false,
          minItems: 2,
          maxItems: 2,
        },
      },
      additionalProperties: false,
    });
  });

  it('requires a meaningful Vite config path', () => {
    expect(getParsingFlagProperties().viteConfigPath).toEqual({
      type: 'string',
      minLength: 1,
      pattern: '\\S',
      description: 'Vite config path relative to the project root',
    });
  });
});
