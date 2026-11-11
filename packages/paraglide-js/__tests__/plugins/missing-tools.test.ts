import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build, createLogger } from 'vite';
import { parseSync } from 'oxc-parser';
import { paraglideContext } from '../../src/compiler.js';
import { vueLanguage } from '../../lib/compiler/languages/vue.js';
import {
  parseSource,
  type ParseFunction,
} from '../../lib/compiler/languages/language.js';

const directories: string[] = [];
afterAll(() =>
  Promise.all(
    directories.map((d) => fs.rm(d, { recursive: true, force: true }))
  )
);

/** Outside this repository, so none of its tools resolve. */
async function project(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paraglide-context-'));
  directories.push(root);
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  return root;
}

test('a format whose tools are not installed: one warning with the install command', async () => {
  const root = await project({
    'package.json': `{ "name": "app", "type": "module" }`,
    'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
    'src/main.ts': 'export {};\n',
    'src/App.vue': `<template><p>{{ m.greeting() }}</p></template>\n`,
    'src/Card.vue': `<template><p>{{ m.card() }}</p></template>\n`,
  });
  const warnings: string[] = [];
  const logger = createLogger('silent');
  logger.warn = (message) => void warnings.push(message);
  await build({
    root,
    configFile: false,
    customLogger: logger,
    logLevel: 'silent',
    plugins: [paraglideContext({ enabled: true })],
    build: {
      write: false,
      lib: { entry: path.join(root, 'src/main.ts'), formats: ['es'] },
    },
  });
  expect(warnings.filter((warning) => warning.includes('.vue'))).toEqual([
    '[paraglide-context] 2 .vue file(s) were not analyzed (e.g. src/App.vue): they need ' +
      '@vue/language-core and typescript, which are not installed. ' +
      'Install them: pnpm add -D vue-tsc typescript (vue-tsc includes @vue/language-core)',
  ]);
});

test('TypeScript 7, which has no JavaScript API, is named as the reason', async () => {
  const parse: ParseFunction = (file, code, lang) =>
    parseSync(file, code, { lang }) as unknown as ReturnType<ParseFunction>;
  const context = {
    load: async (name: string) =>
      name === 'typescript'
        ? { version: '7.0.2' }
        : name === '@vue/language-core'
          ? { createVueLanguagePlugin() {} }
          : undefined,
  };
  const result = await parseSource(
    '/app/App.vue',
    '<template />',
    parse,
    [vueLanguage],
    context as never
  );
  expect(result).toMatchObject({
    language: 'vue',
    missing: [],
    reason: expect.stringContaining('TypeScript 7'),
  });
});
