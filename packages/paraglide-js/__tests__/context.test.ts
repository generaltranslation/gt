// `collectContext` and the CLI: which files of a project are analyzed, and what
// is written and reported. Import aliases are in resolver/aliases.test.ts.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { build } from 'vite';
import { main } from '../src/compiler/cli/index.js';
import { createCollector } from '../src/compiler/collector/create.js';
import { nodeResolver } from '../src/compiler/resolver/node-resolver.js';
import {
  collect,
  compileMessages,
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

/** A project outside this repository: only `packages` resolve from it. */
async function writeOutsideProject(
  files: Record<string, string>,
  packages: readonly string[] = []
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paraglide-context-'));
  outside.push(root);

  await writeFiles(root, {
    'package.json': `{ "name": "app", "type": "module" }`,
    'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
    ...files,
  });

  for (const name of packages) {
    const installed = path.resolve(
      import.meta.dirname,
      '../node_modules',
      name
    );
    const link = path.join(root, 'node_modules', name);

    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink(await fs.realpath(installed), link);
  }

  return root;
}

describe('collectContext', () => {
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
    // By code units, whatever the machine's locale: `Title` before `main`.
    expect(usages).toEqual([
      'app/page.astro: <p>{m.greeting()}</p>',
      'src/Card.svelte: <p title={m.greeting()}></p>',
      'src/Card.vue: <template><p>{{ m.greeting() }}</p></template>',
      'src/Title.tsx: export const Title = () => <h1 title={m.greeting()} />;',
      greetingIn('src/main.ts'),
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

  test('a dynamic name gives its usage to every message it matches', async () => {
    const ids = ['error_404', 'error_500', 'greeting'];
    const root = await writeProject('context-dynamic', {
      ...filesIn('src/paraglide', await compileMessages(ids)),
      'messages/en.json': JSON.stringify(
        Object.fromEntries(ids.map((id) => [id, 'Hi']))
      ),
      'src/main.ts': [
        `import { m } from "./paraglide/messages.js";`,
        'export const error = (code: number) => m[`error_${code}`]();',
        'export const hint = (kind: string) => m[`hint_${kind}`]();',
      ].join('\n'),
    });
    const { warnings } = await collect(root);
    const snippet =
      'src/main.ts: export const error = (code: number) => m[`error_${code}`]();';
    expect(await readSnippets(root, { message: 'error_404' })).toEqual([
      snippet,
    ]);
    expect(await readSnippets(root, { message: 'error_500' })).toEqual([
      snippet,
    ]);
    expect(Object.keys(await readMetadata(root))).toEqual([
      'error_404',
      'error_500',
    ]);
    expect(warnings).toEqual([
      expect.stringContaining(
        '1 usage(s) of messages not in the catalog: hint_* (src/main.ts:3:'
      ),
    ]);
  });

  test('a long list of unknown messages is cut', async () => {
    const root = await writeProject('context-catalog-many', {
      'src/main.ts': [
        `import { m } from "./paraglide/messages.js";`,
        ...Array.from({ length: 12 }, (_, i) => `m.typo${i}();`),
      ].join('\n'),
    });
    const { warnings } = await collect(root);
    expect(warnings).toEqual([
      expect.stringMatching(
        /12 usage\(s\) of messages not in the catalog: typo0 .*typo9 \(src\/main\.ts:11:1\), and 2 more$/
      ),
    ]);
  });

  test('a format whose tools are not installed: one warning with the install command', async () => {
    const root = await writeOutsideProject({
      'src/main.ts': 'export {};\n',
      'src/App.vue': `<template><p>{{ m.greeting() }}</p></template>\n`,
      'src/Card.vue': `<template><p>{{ m.card() }}</p></template>\n`,
    });
    const { warnings } = await collect(root);
    expect(warnings.filter((warning) => warning.includes('.vue'))).toEqual([
      '[paraglide-context] 2 .vue file(s) were not analyzed (e.g. src/App.vue): they need ' +
        '@vue/language-core and typescript, which are not installed. ' +
        'Install them: pnpm add -D vue-tsc typescript (vue-tsc includes @vue/language-core)',
    ]);
  });

  test('Markdown without the Vue tools: only a page with a script is reported', async () => {
    const root = await writeOutsideProject({
      'src/main.ts': 'export {};\n',
      'README.md': [
        '# App',
        'Add a `<script>` tag to the page:',
        '```html',
        '<script src="app.js"></script>',
        '```',
        '<!-- <script src="old.js"></script> -->',
        '',
      ].join('\n'),
      'docs/index.md': `<script setup>\nimport { m } from "../src/paraglide/messages.js";\n</script>\n\n# {{ m.greeting() }}\n`,
    });
    const { warnings } = await collect(root);
    expect(warnings.filter((warning) => warning.includes('.md'))).toEqual([
      '[paraglide-context] 1 .md file(s) were not analyzed (e.g. docs/index.md): they need ' +
        '@vue/language-core and typescript, which are not installed. ' +
        'Install them: pnpm add -D vue-tsc typescript (vue-tsc includes @vue/language-core)',
    ]);
  });

  test('a pug template without its plugin: one warning, and the script is still analyzed', async () => {
    const root = await writeOutsideProject(
      {
        '.git/HEAD': 'ref: refs/heads/main\n',
        ...inlangProject,
        ...filesIn('src/paraglide', outdir),
        'src/App.vue': [
          `<script setup>`,
          `import { m } from "./paraglide/messages.js";`,
          `const label = m.greeting();`,
          `</script>`,
          `<template lang="pug">`,
          `p {{ m.greeting() }}`,
          `</template>`,
          ``,
        ].join('\n'),
        'node_modules/vue/package.json': `{ "name": "vue", "main": "index.js" }`,
        'node_modules/vue/index.js': '',
      },
      ['@inlang/paraglide-js', '@vue/language-core', 'typescript']
    );
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual(['src/App.vue: const label = m.greeting();']);
    expect(warnings).toEqual([
      '[paraglide-context] pug templates in 1 .vue file(s) were not analyzed (e.g. src/App.vue): they need ' +
        '@vue/language-plugin-pug, which is not installed. ' +
        'Install it: pnpm add -D @vue/language-plugin-pug',
    ]);
  });

  test('a format whose tool is installed but fails to load: one warning that names it', async () => {
    const root = await writeProject('context-broken-tool', {
      'src/main.ts': useGreeting('./paraglide/messages.js'),
      'src/Card.svelte': `<p>{m.greeting()}</p>\n`,
      'node_modules/svelte2tsx/package.json': `{ "name": "svelte2tsx", "main": "index.js" }`,
      'node_modules/svelte2tsx/index.js': 'throw new Error("broken");\n',
    });
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual([greetingIn('src/main.ts')]);
    expect(warnings).toEqual([
      '[paraglide-context] 1 .svelte file(s) were not analyzed (e.g. src/Card.svelte): ' +
        'svelte2tsx could not be loaded.',
    ]);
  });

  test('a format whose tool is installed but unusable: one warning with the reason', async () => {
    const root = await writeProject('context-typescript-7', {
      'src/main.ts': useGreeting('./paraglide/messages.js'),
      'src/App.vue': `<template><p>{{ m.greeting() }}</p></template>\n`,
      // TypeScript 7 has no JavaScript API.
      'node_modules/typescript/package.json': `{ "name": "typescript", "main": "index.js" }`,
      'node_modules/typescript/index.js': 'module.exports = {};\n',
    });
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual([greetingIn('src/main.ts')]);
    expect(warnings).toEqual([
      '[paraglide-context] 1 .vue file(s) were not analyzed (e.g. src/App.vue): ' +
        "the project's typescript has no JavaScript API (TypeScript 7), which @vue/language-core needs; " +
        'it works with typescript 5 or 6.',
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
      'lib/skipped.ts': useGreeting('../src/paraglide/messages.js'),
      'other/d.ts': useGreeting('../src/paraglide/messages.js'),
    });
    const { usages, warnings } = await collect(root, {
      include: ['src', 'lib/*.ts', 'missing'],
      exclude: ['**/*.stories.tsx', 'lib/skipped.ts'],
    });
    expect(usages).toEqual([greetingIn('lib/c.ts'), greetingIn('src/a.ts')]);
    expect(warnings).toEqual([
      expect.stringContaining('include entry missing does not exist'),
    ]);
  });
});

describe('auto-imports', () => {
  const usesGlobal = 'export const text = m.greeting();\n';

  const declarations = [
    'export {}',
    'declare global {',
    "  const m: typeof import('./src/paraglide/messages')['m']",
    "  const t: typeof import('./src/i18n')['t']",
    "  const ref: typeof import('vue')['ref']",
    '}',
  ].join('\n');

  test('unplugin-auto-import declarations, of Paraglide and of a module that re-exports it', async () => {
    const root = await writeProject('context-auto-imports', {
      'src/main.ts': usesGlobal,
      'src/i18n.ts': `export { m as t } from "./paraglide/messages.js";\n`,
      'src/other.ts': 'export const text = t.greeting();\n',
      'auto-imports.d.ts': declarations,
    });
    expect((await collect(root)).usages).toEqual([
      greetingIn('src/main.ts'),
      'src/other.ts: export const text = t.greeting();',
    ]);
  });

  test('`autoImports: false` reads no declarations', async () => {
    const root = await writeProject('context-auto-imports-off', {
      'src/main.ts': usesGlobal,
      'auto-imports.d.ts': declarations,
    });
    const { usages } = await collect(root, { autoImports: false });
    expect(usages).toEqual([]);
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

  test('the autoImports option wins over a declaration of the same name, even when it resolves later', async () => {
    const root = await writeProject('context-auto-imports-order', {
      'src/main.ts': usesGlobal,
      'src/other.ts': "export const m = { greeting: () => '' };\n",
      'auto-imports.d.ts': [
        'export {}',
        'declare global {',
        "  const m: typeof import('./src/other')['m']",
        '}',
      ].join('\n'),
    });
    const resolve = nodeResolver();
    const collector = createCollector(
      { autoImports: { m: './src/paraglide/messages.js' } },
      {
        root,
        logger: { warn() {}, info() {} },
        resolver: async (specifier, importer) => {
          const isOption = specifier === './src/paraglide/messages.js';
          if (isOption) await new Promise((done) => setTimeout(done, 50));

          return resolve(specifier, importer);
        },
      }
    );
    await collector.scanAll();
    await collector.write();

    expect(await readSnippets(root)).toEqual([greetingIn('src/main.ts')]);
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
      'src/c.ts': useGreeting('#absolute/paraglide/messages.js'),
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
      '--alias',
      `#absolute=${path.join(root, 'src')}`,
      '--project',
      'i18n/project.inlang',
    ]);
    expect(code).toBe(0);
    expect(
      await readSnippets(root, { file: 'i18n/messages/en.metadata.json' })
    ).toEqual([greetingIn('src/a.ts'), greetingIn('src/c.ts')]);
    expect(await readSnippets(root)).toEqual([]);
  });

  test('--alias is relative to the project root when root is a directory in it', async () => {
    const root = await writeProject('context-cli-alias-root', {
      'app/main.ts': useGreeting('@/paraglide/messages.js'),
    });

    expect(await main([path.join(root, 'app'), '--alias', '@=./src'])).toBe(0);
    expect(await readSnippets(root)).toEqual([greetingIn('app/main.ts')]);
  });

  test('wrong arguments print the usage and exit with 2; --help prints it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const usage = expect.stringContaining('Usage: paraglide-context');

    for (const argv of [['--unknown'], ['--radius', 'x'], ['a', 'b']]) {
      expect(await main(argv)).toBe(2);
      expect(error).toHaveBeenLastCalledWith(usage);
    }
    expect(error).toHaveBeenCalledTimes(3);

    expect(await main(['--help'])).toBe(0);
    expect(log).toHaveBeenCalledWith(usage);
    vi.restoreAllMocks();
  });
});
