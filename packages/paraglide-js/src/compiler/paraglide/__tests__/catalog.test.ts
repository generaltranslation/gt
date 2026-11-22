import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { compileCatalog } from '@inlang/paraglide-js';
import {
  matchesPattern,
  readCatalog,
} from '../../src/compiler/paraglide/catalog.js';
import { writeFiles } from '../helpers/files.js';

const TMP = path.join(import.meta.dirname, '.tmp', 'catalog');

afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

const IDS = ['greeting', 'foo-bar', 'error_404', 'error_500'];

function bundle(id: string) {
  return {
    id,
    declarations: [],
    messages: ['en', 'de'].map((locale) => ({
      id: `${id}_${locale}`,
      bundleId: id,
      locale,
      selectors: [],
      variants: [
        {
          id: `${id}_${locale}_v`,
          messageId: `${id}_${locale}`,
          matches: [],
          pattern: [{ type: 'text', value: 'Hi' }],
        },
      ],
    })),
  };
}

type Output = Record<string, string>;

let count = 0;
async function write(output: Output): Promise<string> {
  const directory = path.join(TMP, `outdir-${count++}`);
  await writeFiles(directory, output);
  return directory;
}

const compile = (compilerOptions: object = {}): Promise<Output> =>
  compileCatalog({
    catalog: {
      settings: { baseLocale: 'en', locales: ['en', 'de'] },
      bundles: IDS.map(bundle),
    },
    compilerOptions: { emitTsDeclarations: true, ...compilerOptions },
  } as never);

const sorted = (ids: Set<string> | undefined) => (ids ? [...ids].sort() : ids);

describe('Paraglide 3', () => {
  test.each([
    ['message-modules', {}],
    ['locale-modules', { outputStructure: 'locale-modules' }],
    ['sharded message-modules', { messageModuleSize: 3 }],
    ['without eslint comments', { includeEslintDisableComment: false }],
  ])('%s', async (_name, options) => {
    expect(
      sorted(await readCatalog(await write(await compile(options))))
    ).toEqual([...IDS].sort());
  });

  test('virtual-modules: the declarations list the messages', async () => {
    const output = await compile();
    const directory = path.join(TMP, `outdir-${count++}`);
    const plugins = path.join(
      import.meta.dirname,
      '../../node_modules/@inlang/paraglide-js/dist/bundler-plugins/virtual-messages.js'
    );
    const { virtualMessageOutput } = await import(plugins);
    const { disk } = virtualMessageOutput(output, directory, undefined);
    // No message modules on disk: only the declarations name the messages.
    expect(Object.keys(disk as Output).join()).not.toContain('messages/');
    await writeFiles(directory, disk as Output);
    expect(sorted(await readCatalog(directory))).toEqual([...IDS].sort());
  });
});

test('Paraglide 2', async () => {
  const installed = await fs.realpath(
    path.join(import.meta.dirname, '../../node_modules/paraglide-js-2')
  );
  const paraglide = await import('paraglide-js-2');
  const sdk = await import(
    createRequire(path.join(installed, '_.js')).resolve('@inlang/sdk')
  );
  const blob = await sdk.newProject({
    settings: { baseLocale: 'en', locales: ['en', 'de'], telemetry: 'off' },
  });
  const project = await sdk.loadProjectInMemory({ blob });
  for (const id of IDS) await sdk.insertBundleNested(project.db, bundle(id));
  for (const outputStructure of [
    'message-modules',
    'locale-modules',
  ] as const) {
    const output = await paraglide.compileProject({
      project,
      compilerOptions: { outputStructure },
    });
    expect(sorted(await readCatalog(await write(output)))).toEqual(
      [...IDS].sort()
    );
  }
  await project.close();
}, 60_000);

describe('Paraglide 1', () => {
  // Its compiler sends telemetry, so the files are written here, as it writes them.
  test('one module per locale', async () => {
    const directory = await write({
      'runtime.js': 'export const sourceLanguageTag = "en"',
      'messages.js': [
        '/* eslint-disable */',
        'import { languageTag } from "./runtime.js"',
        'import * as en from "./messages/en.js"',
        '',
        'export const greeting = (params = {}, options = {}) => en.greeting(params)',
        'export const farewell = () => en.farewell()',
      ].join('\n'),
      'messages/en.js':
        '/* eslint-disable */\nexport const greeting = () => `Hi`',
    });
    expect(sorted(await readCatalog(directory))).toEqual([
      'farewell',
      'greeting',
    ]);
  });

  test('message-modules', async () => {
    const directory = await write({
      'messages.js': [
        '/* eslint-disable */',
        'export * from "./messages/index/greeting.js"',
        'export * from "./messages/index/farewell.js"',
      ].join('\n'),
      'messages/index/greeting.js':
        '/* eslint-disable */\nexport const greeting = () => `Hi`',
      'messages/index/farewell.js':
        '/* eslint-disable */\nexport const farewell = () => `Bye`',
    });
    expect(sorted(await readCatalog(directory))).toEqual([
      'farewell',
      'greeting',
    ]);
  });
});

test('an unreadable outdir has no catalog', async () => {
  expect(await readCatalog(path.join(TMP, 'missing'))).toBeUndefined();
  const broken = await write({
    'messages.js': "export * from './messages/_index.js'",
  });
  expect(await readCatalog(broken)).toBeUndefined();
});

test('dynamic patterns', () => {
  expect(matchesPattern('error_*', 'error_404')).toBe(true);
  expect(matchesPattern('error_*', 'greeting')).toBe(false);
  expect(matchesPattern('*', 'foo-bar')).toBe(true);
  expect(matchesPattern('a.b*', 'axb')).toBe(false);
  expect(matchesPattern('greeting', 'greeting')).toBe(true);
});
