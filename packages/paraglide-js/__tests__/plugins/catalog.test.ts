import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build, createLogger } from 'vite';
import { compileCatalog } from '@inlang/paraglide-js';
import { paraglideContext } from '../../src/compiler.js';
import { inlangProject, readMetadata } from './fixture.js';

// Inside the package, so `@inlang/paraglide-js` resolves from the outdirs.
const TMP = path.join(import.meta.dirname, '.tmp', 'catalog');

afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

const greeting = {
  id: 'greeting',
  declarations: [],
  messages: [
    {
      id: 'greeting_en',
      bundleId: 'greeting',
      locale: 'en',
      selectors: [],
      variants: [
        {
          id: 'greeting_en_v',
          messageId: 'greeting_en',
          matches: [],
          pattern: [{ type: 'text', value: 'Hi' }],
        },
      ],
    },
  ],
};

test('usages of messages that are not in the catalog are reported and get no metadata', async () => {
  const outdir = await compileCatalog({
    catalog: {
      settings: { baseLocale: 'en', locales: ['en'] },
      bundles: [greeting],
    } as never,
  });
  const files: Record<string, string> = {
    'package.json': `{ "name": "app", "type": "module" }`,
    ...inlangProject,
    ...Object.fromEntries(
      Object.entries(outdir).map(([file, code]) => [
        `src/paraglide/${file}`,
        code,
      ])
    ),
    'src/main.ts': [
      `import { m } from "./paraglide/messages.js";`,
      `export const ok = m.greeting();`,
      `export const typo = m.greting();`,
    ].join('\n'),
  };
  // Its own repository, as an app is: this repo's .gitignore (`.tmp`) does not apply.
  files['.git/HEAD'] = 'ref: refs/heads/main\n';
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(TMP, file)), { recursive: true });
    await fs.writeFile(path.join(TMP, file), content);
  }

  const warnings: string[] = [];
  const logger = createLogger('silent');
  logger.warn = (message) => void warnings.push(message);
  await build({
    root: TMP,
    configFile: false,
    customLogger: logger,
    logLevel: 'silent',
    plugins: [paraglideContext({ enabled: true })],
    build: {
      write: false,
      lib: { entry: path.join(TMP, 'src/main.ts'), formats: ['es'] },
    },
  });

  // A key the message file does not have would fail the gt CLI's upload.
  expect(Object.keys(await readMetadata(TMP))).toEqual(['greeting']);
  // Rolldown warns about the missing export too.
  expect(
    warnings.filter((warning) => warning.includes('[paraglide-context]'))
  ).toEqual([
    '[paraglide-context] 1 usage(s) of messages not in the catalog: greting (src/main.ts:3:21)',
  ]);
});
