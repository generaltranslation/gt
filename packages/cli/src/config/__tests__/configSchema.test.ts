import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { FILE_FORMAT_TO_CONFIG_FILE_TYPE } from '../../formats/files/transformFormat.js';

type SchemaObject = {
  properties: Record<string, SchemaObject>;
  definitions: Record<string, SchemaObject>;
  required?: string[];
};

const schema = JSON.parse(
  fs.readFileSync(
    new URL('../../../../../assets/config-schema.json', import.meta.url),
    'utf8'
  )
) as SchemaObject;

describe('gt.config.json schema', () => {
  it('covers every file type supported by the CLI', () => {
    const fileProperties = schema.definitions.files.properties;

    expect(Object.keys(fileProperties)).toEqual(
      expect.arrayContaining(['gt', ...SUPPORTED_FILE_EXTENSIONS])
    );
    expect(Object.keys(fileProperties)).toEqual(
      expect.arrayContaining(Object.keys(FILE_FORMAT_TO_CONFIG_FILE_TYPE))
    );
  });

  it('covers shared runtime, CLI, and framework configuration', () => {
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        'defaultLocale',
        'locales',
        'customMapping',
        'enableI18n',
        'projectId',
        'devApiKey',
        'apiKey',
        '_versionId',
        '_branchId',
        'cacheUrl',
        'cacheExpiryTime',
        'runtimeUrl',
        'modelProvider',
        '_disableDevHotReload',
        'files',
        'publish',
        'omitConfigIds',
        'skipVersionCheck',
        'parsingOptions',
        'branchOptions',
        'headersAndCookies',
        'experimentalCompilerOptions',
      ])
    );
  });

  it('covers current compiler flags and CLI schema options', () => {
    const parsingFlags = schema.definitions.gtParsingFlags.properties;
    const additionalOptions = schema.definitions.additionalOptions.properties;
    const jsonSchema = schema.definitions.jsonSchemaConfig.properties;
    const sourceObject = schema.definitions.sourceObjectOptions.properties;

    expect(Object.keys(parsingFlags)).toEqual(
      expect.arrayContaining([
        'autoderive',
        'includeSourceCodeContext',
        'enableAutoJsxInjection',
        'legacyGtReactImportSource',
        'devHotReload',
      ])
    );
    expect(Object.keys(additionalOptions)).toEqual(
      expect.arrayContaining([
        'excludeStaticUrls',
        'excludeStaticImports',
        'experimentalAddHeaderAnchorIds',
        'experimentalCanonicalLocaleKeys',
      ])
    );
    expect(Object.keys(jsonSchema)).toEqual(
      expect.arrayContaining(['structuralTransform', 'resolveRefs'])
    );
    expect(Object.keys(sourceObject)).toEqual(
      expect.arrayContaining(['omitProperties', 'splitEntries'])
    );
  });

  it('keeps defaultLocale and locales optional like the shared GTConfig type', () => {
    expect(schema.required).toBeUndefined();
  });
});
