import fs from 'node:fs';
import path from 'node:path';
import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { GTConfig } from 'generaltranslation/types';
import {
  createConfigReadError,
  createInvalidExportError,
  createMissingFileError,
} from './diagnostics';
import type { ConfigModuleOptions } from './types';

export const CONFIG_MODULE_ID = 'gt-tanstack-start/internal/_config';
export const RESOLVED_CONFIG_MODULE_ID = '\0gt-tanstack-start:config';
export const LOCALE_ROUTING_MODULE_ID =
  'gt-tanstack-start/internal/localeRouting';
const CUSTOM_LOADER_FILES = [
  'src/loadTranslations.ts',
  'src/loadTranslations.tsx',
  'src/loadTranslations.js',
  'src/loadTranslations.jsx',
];
const DICTIONARY_FILES = ['', 'src/'].flatMap((directory) =>
  ['.ts', '.js', '.json'].map(
    (extension) => `${directory}dictionary${extension}`
  )
);
const DICTIONARY_LOADER_FILES = ['', 'src/'].flatMap((directory) =>
  ['.ts', '.js'].map((extension) => `${directory}loadDictionary${extension}`)
);

export function readConfigFile(configFile: string): GTConfig {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8')) as GTConfig;
  } catch (error) {
    throw createConfigReadError(configFile, error);
  }
}

/**
 * The file an option names, relative to the working directory, or else the
 * first default that exists, relative to the app root.
 */
function findModuleFile(
  root: string,
  cwd: string,
  option: string,
  configured: string | undefined,
  defaults: string[]
): string | undefined {
  if (configured !== undefined) {
    const file = path.resolve(cwd, configured);
    if (!fs.existsSync(file)) throw createMissingFileError(option, configured);
    return file;
  }
  return defaults
    .map((file) => path.join(root, file))
    .find((file) => fs.existsSync(file));
}

/**
 * Exports `name` from the file's default or named export, failing loudly
 * when neither exists: a fallback would silently drop the app's setting.
 */
function exportFromFile(
  root: string,
  file: string,
  name: string,
  type: 'function' | 'object',
  what: string
): string[] {
  const relative = path.relative(root, file);
  // A file on another Windows drive has no relative path.
  const specifier = path.isAbsolute(relative)
    ? `/@fs/${file.split(path.sep).join('/')}`
    : `/${relative.split(path.sep).join('/')}`;
  const local = `${name}Module`;
  return [
    `import * as ${local} from ${JSON.stringify(specifier)};`,
    `const ${name} = ${local}.default ?? ${local}.${name};`,
    `if (typeof ${name} !== '${type}' || ${name} === null) {`,
    `  throw new Error(${JSON.stringify(createInvalidExportError(relative, what, type === 'function' ? `${name} function` : `${name} object`))});`,
    '}',
    `export { ${name} };`,
  ];
}

export function createConfigModule(
  root: string,
  cwd: string,
  configFile: string,
  {
    dictionary,
    loadDictionaryPath,
    loadTranslationsPath,
    ...runtimeOptions
  }: ConfigModuleOptions
): { code: string; localeRouting: boolean; omittedApiKeys: boolean } {
  const config = readConfigFile(configFile);
  // The browser imports this module too, so credentials must never be in it.
  const { apiKey, devApiKey, ...publicConfig } = config;
  // An explicit undefined would erase the gt.config.json value.
  const definedRuntimeOptions = Object.fromEntries(
    Object.entries(runtimeOptions).filter(([, value]) => value !== undefined)
  );
  const lines = [
    `export const config = ${JSON.stringify({ ...publicConfig, ...definedRuntimeOptions })};`,
  ];

  const dictionaryFile = findModuleFile(
    root,
    cwd,
    'dictionary',
    dictionary,
    DICTIONARY_FILES
  );
  lines.push(
    ...(dictionaryFile
      ? exportFromFile(
          root,
          dictionaryFile,
          'dictionary',
          'object',
          'a dictionary'
        )
      : ['export const dictionary = undefined;'])
  );
  const dictionaryLoader = findModuleFile(
    root,
    cwd,
    'loadDictionaryPath',
    loadDictionaryPath,
    DICTIONARY_LOADER_FILES
  );
  lines.push(
    ...(dictionaryLoader
      ? exportFromFile(
          root,
          dictionaryLoader,
          'loadDictionary',
          'function',
          'a dictionary loader'
        )
      : ['export const loadDictionary = undefined;'])
  );

  const customLoader = findModuleFile(
    root,
    cwd,
    'loadTranslationsPath',
    loadTranslationsPath,
    CUSTOM_LOADER_FILES
  );
  const output = config.files?.gt?.output;

  if (customLoader) {
    lines.push(
      ...exportFromFile(
        root,
        customLoader,
        'loadTranslations',
        'function',
        'a translation loader'
      )
    );
  } else if (output?.includes('[locale]')) {
    const pattern = `/${path
      .relative(root, path.resolve(cwd, output))
      .split(path.sep)
      .join('/')}`;
    // Like the gt CLI, replace every placeholder. The rest of the path is
    // literal, so its glob characters are escaped.
    const segments = pattern.split('[locale]');
    const glob = segments
      .map((segment) => segment.replace(/[\\*?[\]{}()!+@]/g, '\\$&'))
      .join('*');
    lines.push(
      `const files = import.meta.glob(${JSON.stringify(glob)}, { import: 'default' });`,
      'export async function loadTranslations(locale) {',
      // Locale twins carry the browser's translations in the build, so only
      // the server loads whole locales. The constant condition lets the
      // production client build drop every locale file. Dictionary entries
      // are never twinned, so an app with a dictionary keeps loading them.
      ...(isLocaleTwinsSplitting(config.files?.gt?.splitting) && !dictionaryFile
        ? ['  if (import.meta.env.PROD && !import.meta.env.SSR) return {};']
        : []),
      `  const load = files[${segments.map((segment) => JSON.stringify(segment)).join(' + locale + ')}];`,
      '  return load ? load() : {};',
      '}'
    );
  } else {
    // No local translations: GT loads from the CDN.
    lines.push('export const loadTranslations = undefined;');
  }

  return {
    code: lines.join('\n'),
    localeRouting: config.localeRouting === true,
    omittedApiKeys: apiKey !== undefined || devApiKey !== undefined,
  };
}
