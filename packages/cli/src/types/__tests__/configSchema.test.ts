import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  const parsingFlagProperties =
    schema.properties?.files?.properties?.gt?.properties?.parsingFlags
      ?.properties;

  expect(parsingFlagProperties).toBeDefined();
  return parsingFlagProperties ?? {};
}

describe('GT config schema parsing flags', () => {
  it('retains the complete canonical parsing flag surface', () => {
    expect(Object.keys(getParsingFlagProperties()).sort()).toEqual([
      'autoderive',
      'devHotReload',
      'enableAutoJsxInjection',
      'includeSourceCodeContext',
      'legacyGtReactImportSource',
      'viteConfigPath',
      'vueCompilerOptions',
    ]);
  });

  it('accepts the existing boolean and granular dev hot reload forms', () => {
    expect(getParsingFlagProperties().devHotReload).toEqual({
      oneOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            strings: { type: 'boolean' },
            jsx: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      ],
    });
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
