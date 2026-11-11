import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { main } from '../../lib/compiler/cli/index.js';
import {
  collectContext,
  watchContext,
} from '../../lib/compiler/plugins/node.js';
import {
  greetingIn,
  inlangProject,
  readSnippets,
  useGreeting,
  writeProject,
} from './fixture.js';

describe('without a bundler', () => {
  test('collectContext: tsconfig paths, package imports, .js → .ts', async () => {
    const root = await writeProject('node-collect', {
      'package.json': `{ "name": "app", "type": "module", "imports": { "#i18n/*": "./src/paraglide/*" } }`,
      'tsconfig.json': `{ "compilerOptions": { "baseUrl": ".", "paths": { "~/*": ["./src/*"] } } }`,
      'src/a.ts': useGreeting('~/paraglide/messages.js'),
      'src/b.ts': useGreeting('#i18n/messages.js'),
      'src/c.ts': `export { m } from "./paraglide/messages.js";\n`,
      'src/d.ts': `import { m } from "./c.js";\nexport const text = m.greeting();\n`,
    });
    await collectContext({ root });
    expect(await readSnippets(root)).toEqual([
      greetingIn('src/a.ts'),
      greetingIn('src/b.ts'),
      greetingIn('src/d.ts'),
    ]);
  });

  test('the CLI: --include, --alias, --project', async () => {
    const root = await writeProject('node-cli', {
      'src/a.ts': useGreeting('@/paraglide/messages.js'),
      'lib/b.ts': useGreeting('../src/paraglide/messages.js'),
      // Not found by detection: it is not in the project root.
      'i18n/project.inlang/settings.json':
        inlangProject['project.inlang/settings.json']!,
      'i18n/messages/en.json': inlangProject['messages/en.json']!,
    });
    const code = await main([
      root,
      '--include',
      'src',
      '--alias',
      '@=./src',
      '--project',
      'i18n/project.inlang',
    ]);
    expect(code).toBe(0);
    expect(
      await readSnippets(root, { file: 'i18n/messages/en.metadata.json' })
    ).toEqual([greetingIn('src/a.ts')]);
    expect(await readSnippets(root)).toEqual([]);
    expect(await main(['--radius', 'x'])).toBe(2);
  });

  test('watchContext updates the files', async () => {
    const root = await writeProject('node-watch', {
      'src/a.ts': useGreeting('./paraglide/messages.js'),
    });
    const watcher = watchContext({ root });
    await watcher.ready;
    expect(await readSnippets(root)).toEqual([greetingIn('src/a.ts')]);
    await fs.writeFile(
      path.join(root, 'src/b.ts'),
      useGreeting('./paraglide/messages.js')
    );
    await expect
      .poll(() => readSnippets(root), { timeout: 5000 })
      .toEqual([greetingIn('src/a.ts'), greetingIn('src/b.ts')]);
    watcher.close();
  });
});
