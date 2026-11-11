// `collectContext`, `watchContext` and the CLI: which files of a project are
// analyzed, and what is written and reported.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { build } from 'vite';
import { main } from '../lib/compiler/cli/index.js';
import { collectContext, watchContext } from '../lib/compiler/context.js';
import {
  collect,
  greetingIn,
  inlangProject,
  outdir,
  filesIn,
  readMetadata,
  readSnippets,
  useGreeting,
  writeProject,
} from './helpers/fixture.js';
import { writeFiles } from './helpers/files.js';

const outside: string[] = [];
afterAll(() =>
  Promise.all(
    outside.map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    )
  )
);

describe('collectContext', () => {
  test('follows tsconfig paths, package imports, .js → .ts and re-exports', async () => {
    const root = await writeProject('context-collect', {
      'package.json': `{ "name": "app", "type": "module", "imports": { "#i18n/*": "./src/paraglide/*" } }`,
      'tsconfig.json': `{ "compilerOptions": { "baseUrl": ".", "paths": { "~/*": ["./src/*"] } } }`,
      'src/a.ts': useGreeting('~/paraglide/messages.js'),
      'src/b.ts': useGreeting('#i18n/messages.js'),
      'src/c.ts': `export { m } from "./paraglide/messages.js";\n`,
      'src/d.ts': useGreeting('./c.js'),
    });
    await collectContext({ root });
    expect(await readSnippets(root)).toEqual([
      greetingIn('src/a.ts'),
      greetingIn('src/b.ts'),
      greetingIn('src/d.ts'),
    ]);
  });

  test('analyzes every format; skips tests, build output, gitignored files and dependencies', async () => {
    const root = await writeProject('context-formats', {
      'src/main.ts': useGreeting('./paraglide/messages.js'),
      'src/Title.tsx': `import { m } from "./paraglide/messages.js";\nexport const Title = () => <h1 title={m.greeting()} />;\n`,
      'src/broken.ts': `export const = ;\n`,
      'src/Card.vue': `<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`,
      'src/Card.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n</script>\n<p title={m.greeting()}></p>\n`,
      'app/page.astro': `---\nimport { m } from "../src/paraglide/messages.js";\n---\n<p>{m.greeting()}</p>\n`,
      'src/main.test.ts': useGreeting('./paraglide/messages.js'),
      'dist/main.js': useGreeting('../src/paraglide/messages.js'),
      '.gitignore': 'ignored/\n',
      'ignored/a.ts': useGreeting('../src/paraglide/messages.js'),
      'node_modules/lib/index.js': useGreeting(
        '../../src/paraglide/messages.js'
      ),
      // The Vue tooling's TypeScript imports from "vue", which an app has installed.
      'node_modules/vue/package.json': `{ "name": "vue", "main": "index.js" }`,
      'node_modules/vue/index.js': '',
    });
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual([
      'app/page.astro: <p>{m.greeting()}</p>',
      'src/Card.svelte: <p title={m.greeting()}></p>',
      'src/Card.vue: <template><p>{{ m.greeting() }}</p></template>',
      greetingIn('src/main.ts'),
      'src/Title.tsx: export const Title = () => <h1 title={m.greeting()} />;',
    ]);
    expect(warnings).toEqual([
      expect.stringContaining('skipped src/broken.ts: '),
    ]);
  });

  test('usages of messages that are not in the catalog are reported and get no metadata', async () => {
    const root = await writeProject('context-catalog', {
      'src/main.ts': [
        `import { m } from "./paraglide/messages.js";`,
        `export const ok = m.greeting();`,
        `export const typo = m.greting();`,
      ].join('\n'),
    });
    const { warnings } = await collect(root);
    // A key the message file does not have would fail the gt CLI's upload.
    expect(Object.keys(await readMetadata(root))).toEqual(['greeting']);
    expect(warnings).toEqual([
      '[paraglide-context] 1 usage(s) of messages not in the catalog: greting (src/main.ts:3:21)',
    ]);
  });

  test('warns about a Paraglide import that does not resolve', async () => {
    const root = await writeProject('context-unresolved', {
      'src/a.ts': useGreeting('$missing/paraglide/messages.js'),
    });
    const { warnings } = await collect(root);
    expect(warnings).toContainEqual(
      expect.stringContaining(
        `could not resolve "$missing/paraglide/messages.js" from src/a.ts`
      )
    );
  });

  test('a format whose tools are not installed: one warning with the install command', async () => {
    // Outside this repository, so none of its tools resolve.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paraglide-context-'));
    outside.push(root);
    const files: Record<string, string> = {
      'package.json': `{ "name": "app", "type": "module" }`,
      'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
      'src/main.ts': 'export {};\n',
      'src/App.vue': `<template><p>{{ m.greeting() }}</p></template>\n`,
      'src/Card.vue': `<template><p>{{ m.card() }}</p></template>\n`,
    };
    await writeFiles(root, files);
    const { warnings } = await collect(root);
    expect(warnings.filter((warning) => warning.includes('.vue'))).toEqual([
      '[paraglide-context] 2 .vue file(s) were not analyzed (e.g. src/App.vue): they need ' +
        '@vue/language-core and typescript, which are not installed. ' +
        'Install them: pnpm add -D vue-tsc typescript (vue-tsc includes @vue/language-core)',
    ]);
  });
});

describe('project layouts', () => {
  test("Nuxt 4: the bundler's root is app/, the project root has the package.json", async () => {
    const app = (file: string) => `app/${file}`;
    const root = await writeProject('context-nuxt4', {
      ...filesIn('app/paraglide', outdir),
      [app('main.ts')]: useGreeting('~/paraglide/messages.js'),
      [app('pages/index.vue')]:
        `<script setup>\nimport { m } from "~/paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`,
      'server/api/hello.ts': useGreeting('../../app/paraglide/messages.js'),
    });
    await fs.rm(path.join(root, 'src'), { recursive: true });
    const { usages } = await collect(root, {
      root: path.join(root, 'app'),
      alias: { '~': path.join(root, 'app') },
    });
    expect(usages).toEqual([
      greetingIn('app/main.ts'),
      'app/pages/index.vue: <template><p>{{ m.greeting() }}</p></template>',
      greetingIn('server/api/hello.ts'),
    ]);
  });

  test.each([
    ['Nuxt 3 / Vike root directories', 'pages/index.ts'],
    ['Laravel', 'resources/js/app.ts'],
  ])('%s', async (name, file) => {
    const root = await writeProject(`context-${name.split(' ')[0]}`, {
      [file]: useGreeting(
        `${'../'.repeat(file.split('/').length - 1)}src/paraglide/messages.js`
      ),
    });
    expect((await collect(root)).usages).toEqual([greetingIn(file)]);
  });

  test("a monorepo's root .gitignore applies to the app", async () => {
    const root = await writeProject('context-monorepo-gitignore', {
      '.gitignore': 'apps/web/generated/\n',
      'apps/web/package.json': `{ "name": "web", "type": "module" }`,
      'apps/web/generated/copy.ts': useGreeting(
        '../../../src/paraglide/messages.js'
      ),
      'apps/web/src/kept.ts': useGreeting('../../../src/paraglide/messages.js'),
    });
    const { usages } = await collect(root, {
      root: path.join(root, 'apps/web'),
    });
    expect(usages).toEqual([greetingIn('src/kept.ts')]);
  });

  test('a parent .gitignore that ignores the project itself does not apply', async () => {
    const root = await writeProject('context-ignored-project', {
      '.gitignore': 'cases/\n',
      'cases/app/package.json': `{ "name": "app", "type": "module" }`,
      'cases/app/src/kept.ts': useGreeting(
        '../../../src/paraglide/messages.js'
      ),
    });
    const { usages } = await collect(root, {
      root: path.join(root, 'cases/app'),
    });
    expect(usages).toEqual([greetingIn('src/kept.ts')]);
  });

  test('files outside the project are analyzed when `include` lists them', async () => {
    const root = await writeProject('context-outside', {
      'app/package.json': `{ "name": "web", "type": "module" }`,
      'app/src/main.ts': `import { text } from "../../shared/text.js";\nconsole.log(text);\n`,
      'shared/text.ts': useGreeting('../src/paraglide/messages.js'),
    });
    const app = path.join(root, 'app');
    expect((await collect(root, { root: app })).usages).toEqual([]);
    expect(
      (await collect(root, { root: app, include: ['.', '../shared'] })).usages
    ).toEqual([greetingIn('../shared/text.ts')]);
  });

  test('include and exclude take paths and globs', async () => {
    const root = await writeProject('context-include', {
      'src/a.ts': useGreeting('./paraglide/messages.js'),
      'src/b.stories.tsx': useGreeting('./paraglide/messages.js'),
      'lib/c.ts': useGreeting('../src/paraglide/messages.js'),
      'other/d.ts': useGreeting('../src/paraglide/messages.js'),
    });
    const { usages, warnings } = await collect(root, {
      include: ['src', 'lib/*.ts', 'missing'],
      exclude: ['**/*.stories.tsx'],
    });
    expect(usages).toEqual([greetingIn('lib/c.ts'), greetingIn('src/a.ts')]);
    expect(warnings).toEqual([
      expect.stringContaining('include entry missing does not exist'),
    ]);
  });
});

describe('auto-imports', () => {
  const usesGlobal = 'export const text = m.greeting();\n';

  test('unplugin-auto-import declarations', async () => {
    const root = await writeProject('context-auto-imports', {
      'src/main.ts': usesGlobal,
      'auto-imports.d.ts': [
        'export {}',
        'declare global {',
        "  const m: typeof import('./src/paraglide/messages')['m']",
        "  const ref: typeof import('vue')['ref']",
        '}',
      ].join('\n'),
    });
    expect((await collect(root)).usages).toEqual([greetingIn('src/main.ts')]);
  });

  test('Nuxt declarations', async () => {
    const root = await writeProject('context-nuxt-imports', {
      ...filesIn('app/paraglide', outdir),
      'app/main.ts': usesGlobal,
      '.nuxt/imports.d.ts': "export { m } from '../app/paraglide/messages';\n",
    });
    await fs.rm(path.join(root, 'src'), { recursive: true });
    expect((await collect(root)).usages).toEqual([greetingIn('app/main.ts')]);
  });

  test('the autoImports option; a local declaration shadows it', async () => {
    const root = await writeProject('context-auto-imports-option', {
      'src/main.ts': usesGlobal,
      'src/local.ts':
        "const m = { greeting: () => '' };\nexport const text = m.greeting();\n",
    });
    const { usages } = await collect(root, {
      autoImports: { m: './src/paraglide/messages.js' },
    });
    expect(usages).toEqual([greetingIn('src/main.ts')]);
  });
});

describe('outdirs', () => {
  test('an outdir that fails verification is used when listed in `outdirs`', async () => {
    const root = await writeProject('context-outdirs', {
      'src/main.ts': useGreeting('./paraglide/messages.js'),
    });
    // As if it was compiled by another Paraglide version.
    const registry = path.join(root, 'src/paraglide/registry.js');
    await fs.writeFile(
      registry,
      (await fs.readFile(registry, 'utf8')) + '\n// other version\n'
    );

    const rejected = await collect(root);
    expect(rejected.usages).toEqual([]);
    expect(rejected.warnings.join('\n')).toContain(
      'src/paraglide is not used as a Paraglide outdir: registry.js was not generated by @inlang/paraglide-js'
    );

    const listed = await collect(root, { outdirs: ['src/paraglide'] });
    expect(listed.usages).toEqual([greetingIn('src/main.ts')]);
    expect(listed.warnings).toEqual([]);
  });

  test("an outdir Paraglide's Vite plugin compiled in virtual-modules mode (its default)", async () => {
    const root = await writeProject('context-virtual-modules', {
      // No modules: Paraglide compiles an empty catalog; `messages/en.json` is only read here.
      'project.inlang/settings.json': JSON.stringify({
        baseLocale: 'en',
        locales: ['en'],
        modules: [],
        'plugin.inlang.messageFormat': {
          pathPattern: './messages/{locale}.json',
        },
      }),
      'src/main.ts': useGreeting('./generated/messages.js'),
    });
    await fs.rm(path.join(root, 'src/paraglide'), { recursive: true });
    const { paraglideVitePlugin } = await import('@inlang/paraglide-js');
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [
        paraglideVitePlugin({
          project: './project.inlang',
          outdir: './src/generated',
        }),
      ],
      build: {
        write: false,
        lib: { entry: path.join(root, 'src/main.ts'), formats: ['es'] },
      },
    }).catch(() => undefined);
    expect(
      await fs.readFile(path.join(root, 'src/generated/messages.js'), 'utf8')
    ).toContain('virtual:paraglide/');

    const { usages, warnings } = await collect(root);
    // Paired with its project by the outdir's README.
    expect(usages).toEqual([greetingIn('src/main.ts')]);
    // The empty catalog has no `greeting`.
    expect(warnings).toEqual([
      expect.stringContaining(
        '1 usage(s) of messages not in the catalog: greeting (src/main.ts'
      ),
    ]);
  });
});

describe('the CLI', () => {
  test('--include, --alias, --project', async () => {
    const root = await writeProject('context-cli', {
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
});

describe('watchContext', () => {
  test('updates the files as sources change', async () => {
    const root = await writeProject('context-watch', {
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
