import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import * as vite8 from 'vite';
import * as vite5 from 'vite5';
import * as vite6 from 'vite6';
import * as vite7 from 'vite7';
import { compileCatalog } from '@inlang/paraglide-js';
import {
  paraglideContext,
  type ParaglideContextOptions,
} from '../../src/compiler.js';
import { greetingIn, inlangProject, readSnippets } from './fixture.js';

// Inside the package, so `@inlang/paraglide-js` resolves from the outdirs.
const TMP = path.join(import.meta.dirname, '.tmp', 'plugin');

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

const outdir = await compileCatalog({
  catalog: {
    settings: { baseLocale: 'en', locales: ['en'] },
    bundles: [greeting],
  } as never,
});

let count = 0;

/** Writes a project with a compiled outdir at `outdirPath` and its inlang project. Returns its root. */
async function project(
  files: Record<string, string>,
  { outdirPath = 'src/paraglide' }: { outdirPath?: string } = {}
): Promise<string> {
  const root = path.join(TMP, `project-${count++}`);
  const all = {
    // Its own repository, as an app is: this repo's .gitignore (`.tmp`) does not apply.
    '.git/HEAD': 'ref: refs/heads/main\n',
    'package.json': `{ "name": "app", "type": "module" }`,
    ...inlangProject,
    ...Object.fromEntries(
      Object.entries(outdir).map(([file, code]) => [
        `${outdirPath}/${file}`,
        code,
      ])
    ),
    ...files,
  };
  for (const [file, content] of Object.entries(all)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  return root;
}

type Vite = typeof vite8;

function silentLogger(vite: Vite) {
  const warnings: string[] = [];
  const logger = vite.createLogger('silent');
  logger.warn = (message) => void warnings.push(message);
  logger.error = (message) => void warnings.push(`error: ${message}`);
  return { logger, warnings };
}

/** Builds `entry` as a library and returns the snippets of `greeting` and the warnings. */
async function build(
  root: string,
  {
    vite = vite8,
    entry = 'src/main.ts',
    viteRoot = root,
    plugins = [],
    config = {},
    ...options
  }: ParaglideContextOptions & {
    vite?: unknown;
    entry?: string;
    viteRoot?: string;
    plugins?: unknown[];
    config?: Record<string, unknown>;
  } = {}
) {
  const v = vite as Vite;
  const { logger, warnings } = silentLogger(v);
  await v.build({
    root: viteRoot,
    configFile: false,
    customLogger: logger,
    logLevel: 'silent',
    ...config,
    plugins: [
      ...(plugins as vite8.Plugin[]),
      paraglideContext({ enabled: true, ...options }),
    ],
    build: {
      write: false,
      lib: { entry: path.join(root, entry), formats: ['es'] },
    },
  });
  return { usages: await readSnippets(root), warnings };
}

const useGreeting = (from: string) =>
  `import { m } from "${from}";\nexport const text = m.greeting();\n`;

test('vite build writes the context of every usage', async () => {
  const root = await project({
    'src/main.ts': useGreeting('./paraglide/messages.js'),
    // Analyzed from disk, not bundled.
    'src/Title.tsx': `import { m } from "./paraglide/messages.js";\nexport const Title = () => <h1 title={m.greeting()} />;\n`,
    'src/broken.ts': `export const = ;\n`,
    'src/Card.vue': `<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`,
    'src/Card.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n</script>\n<p title={m.greeting()}></p>\n`,
    'app/page.astro': `---\nimport { m } from "../src/paraglide/messages.js";\n---\n<p>{m.greeting()}</p>\n`,
    // Not analyzed: tests, build output, gitignored files, dependencies.
    'src/main.test.ts': useGreeting('./paraglide/messages.js'),
    'dist/main.js': useGreeting('../src/paraglide/messages.js'),
    '.gitignore': 'ignored/\n',
    'ignored/a.ts': useGreeting('../src/paraglide/messages.js'),
    'node_modules/lib/index.js': useGreeting('../../src/paraglide/messages.js'),
  });
  const { usages, warnings } = await build(root);
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

test("with Paraglide's Vite plugin in virtual-modules mode (its default)", async () => {
  const root = await project({
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
    'src/aliased.ts': useGreeting('#i18n/messages.js'),
  });
  const { paraglideVitePlugin } = await import('@inlang/paraglide-js');
  const { usages, warnings } = await build(root, {
    plugins: [
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/generated',
      }),
    ],
    config: {
      resolve: { alias: { '#i18n': path.join(root, 'src/generated') } },
    },
  });
  // Resolved to `\0virtual:paraglide/<hash>/messages.js`, then back to the outdir.
  expect(
    await fs.readFile(path.join(root, 'src/generated/messages.js'), 'utf8')
  ).toContain('virtual:paraglide/');
  expect(usages).toEqual([
    greetingIn('src/aliased.ts'),
    greetingIn('src/main.ts'),
  ]);
  // The empty catalog has no `greeting`; Rolldown warns about it too.
  expect(
    warnings.filter((warning) => warning.includes('[paraglide-context]'))
  ).toEqual([
    expect.stringContaining(
      '2 usage(s) of messages not in the catalog: greeting (src/'
    ),
  ]);
});

describe('Vite versions', () => {
  test.each([
    ['5', vite5],
    ['6', vite6],
    ['7', vite7],
    ['8', vite8],
  ])('Vite %s', async (_version, vite) => {
    const root = await project({
      'src/main.ts': useGreeting('@/paraglide/messages.js'),
    });
    const { usages, warnings } = await build(root, {
      vite,
      config: { resolve: { alias: { '@': path.join(root, 'src') } } },
    });
    expect(usages).toEqual([greetingIn('src/main.ts')]);
    expect(warnings).toEqual([]);
  });

  test('Vite 5 dev server', async () => {
    const root = await project({
      'src/main.ts': useGreeting('./paraglide/messages.js'),
    });
    const { logger } = silentLogger(vite5 as unknown as Vite);
    const server = await vite5.createServer({
      root,
      configFile: false,
      customLogger: logger as never,
      plugins: [paraglideContext({ enabled: true }) as never],
      server: { middlewareMode: true, ws: false },
    });
    await server.pluginContainer.buildStart({});
    await waitFor(() =>
      fs.readFile(path.join(root, 'messages/en.metadata.json'), 'utf8')
    );
    expect(await readSnippets(root)).toEqual([greetingIn('src/main.ts')]);
    await server.close();
  });
});

describe('project layouts', () => {
  test("Nuxt 4: Vite's root is app/, the project root has the package.json", async () => {
    const root = await project(
      {
        'app/main.ts': useGreeting('~/paraglide/messages.js'),
        'app/pages/index.vue': `<script setup>\nimport { m } from "~/paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`,
        'server/api/hello.ts': useGreeting('../../app/paraglide/messages.js'),
      },
      { outdirPath: 'app/paraglide' }
    );
    const { usages } = await build(root, {
      entry: 'app/main.ts',
      viteRoot: path.join(root, 'app'),
      config: { resolve: { alias: { '~': path.join(root, 'app') } } },
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
  ])('%s', async (_name, file) => {
    const root = await project({
      'src/main.ts': 'export {};\n',
      [file]: useGreeting(
        `${'../'.repeat(file.split('/').length - 1)}src/paraglide/messages.js`
      ),
    });
    const { usages } = await build(root);
    expect(usages).toEqual([greetingIn(file)]);
  });

  test("a monorepo's root .gitignore applies to the app", async () => {
    const root = await project({
      '.gitignore': 'apps/web/generated/\n',
      'apps/web/package.json': `{ "name": "web", "type": "module" }`,
      'apps/web/src/main.ts': 'export {};\n',
      'apps/web/generated/copy.ts': useGreeting(
        '../../../src/paraglide/messages.js'
      ),
      'apps/web/src/kept.ts': useGreeting('../../../src/paraglide/messages.js'),
    });
    await build(path.join(root, 'apps/web'));
    expect(await readSnippets(root)).toEqual([greetingIn('src/kept.ts')]);
  });

  test('a parent .gitignore that ignores the project itself does not apply', async () => {
    const root = await project({
      '.gitignore': 'cases/\n',
      'cases/app/package.json': `{ "name": "app", "type": "module" }`,
      'cases/app/src/main.ts': 'export {};\n',
      'cases/app/src/kept.ts': useGreeting(
        '../../../src/paraglide/messages.js'
      ),
    });
    await build(path.join(root, 'cases/app'));
    expect(await readSnippets(root)).toEqual([greetingIn('src/kept.ts')]);
  });

  test('monorepo packages the bundler loads are analyzed', async () => {
    const root = await project({
      'apps/web/package.json': `{ "name": "web", "type": "module" }`,
      'apps/web/src/main.ts': `import { text } from "@repo/ui";\nexport { text };\n`,
      'packages/ui/package.json': `{ "name": "@repo/ui", "type": "module" }`,
      'packages/ui/index.ts': useGreeting('../../src/paraglide/messages.js'),
    });
    const web = path.join(root, 'apps/web');
    await build(web, {
      config: {
        resolve: {
          alias: { '@repo/ui': path.join(root, 'packages/ui/index.ts') },
        },
      },
    });
    expect(await readSnippets(root)).toEqual([
      greetingIn('../../packages/ui/index.ts'),
    ]);
  });

  test('include and exclude take paths and globs', async () => {
    const root = await project({
      'src/main.ts': 'export {};\n',
      'src/a.ts': useGreeting('./paraglide/messages.js'),
      'src/b.stories.tsx': useGreeting('./paraglide/messages.js'),
      'lib/c.ts': useGreeting('../src/paraglide/messages.js'),
    });
    const { usages, warnings } = await build(root, {
      include: ['src', 'lib/*.ts', 'missing'],
      exclude: ['**/*.stories.tsx'],
    });
    expect(usages).toEqual([greetingIn('lib/c.ts'), greetingIn('src/a.ts')]);
    expect(warnings).toEqual([
      expect.stringContaining('include entry missing does not exist'),
    ]);
  });
});

describe('resolution', () => {
  test('aliases that a resolveId plugin implements, like vite-tsconfig-paths', async () => {
    const root = await project({
      'src/main.ts': useGreeting('~/paraglide/messages.js'),
    });
    const tsconfigPaths = {
      name: 'fake-tsconfig-paths',
      enforce: 'pre',
      resolveId(id: string) {
        return id.startsWith('~/')
          ? path.join(root, 'src', id.slice(2))
          : undefined;
      },
    };
    const { usages } = await build(root, { plugins: [tsconfigPaths] });
    expect(usages).toEqual([greetingIn('src/main.ts')]);
  });

  test('warns about a Paraglide import that does not resolve', async () => {
    const root = await project({
      'src/main.ts': 'export {};\n',
      'src/a.ts': useGreeting('$missing/paraglide/messages.js'),
    });
    const { warnings } = await build(root);
    expect(warnings).toContainEqual(
      expect.stringContaining(
        `could not resolve "$missing/paraglide/messages.js" from src/a.ts`
      )
    );
  });
});

describe('auto-imports', () => {
  const usesGlobal = 'export const text = m.greeting();\n';

  test('unplugin-auto-import declarations', async () => {
    const root = await project({
      'src/main.ts': usesGlobal,
      'auto-imports.d.ts': [
        'export {}',
        'declare global {',
        "  const m: typeof import('./src/paraglide/messages')['m']",
        "  const ref: typeof import('vue')['ref']",
        '}',
      ].join('\n'),
    });
    const { usages } = await build(root);
    expect(usages).toEqual([greetingIn('src/main.ts')]);
  });

  test('Nuxt declarations', async () => {
    const root = await project(
      {
        'app/main.ts': usesGlobal,
        '.nuxt/imports.d.ts':
          "export { m } from '../app/paraglide/messages';\n",
      },
      { outdirPath: 'app/paraglide' }
    );
    const { usages } = await build(root, { entry: 'app/main.ts' });
    expect(usages).toEqual([greetingIn('app/main.ts')]);
  });

  test('the autoImports option; a local declaration shadows it', async () => {
    const root = await project({
      'src/main.ts': usesGlobal,
      'src/local.ts':
        "const m = { greeting: () => '' };\nexport const text = m.greeting();\n",
    });
    const { usages } = await build(root, {
      autoImports: { m: './src/paraglide/messages.js' },
    });
    expect(usages).toEqual([greetingIn('src/main.ts')]);
  });
});

describe('outdirs', () => {
  test('an outdir that fails verification is used when listed in `outdirs`', async () => {
    const root = await project({
      'src/main.ts': useGreeting('./paraglide/messages.js'),
    });
    // As if it was compiled by another Paraglide version.
    const registry = path.join(root, 'src/paraglide/registry.js');
    await fs.writeFile(
      registry,
      (await fs.readFile(registry, 'utf8')) + '\n// other version\n'
    );

    const rejected = await build(root);
    expect(rejected.usages).toEqual([]);
    expect(rejected.warnings.join('\n')).toContain(
      'src/paraglide is not used as a Paraglide outdir: registry.js was not generated by @inlang/paraglide-js'
    );

    const listed = await build(root, { outdirs: ['src/paraglide'] });
    expect(listed.usages).toEqual([greetingIn('src/main.ts')]);
    expect(listed.warnings).toEqual([]);
  });
});

describe('enabled', () => {
  test('off in Vitest by default', async () => {
    const plugin = paraglideContext();
    const apply = plugin.apply as (
      config: object,
      env: { mode: string; command: string }
    ) => boolean;
    expect(apply({}, { mode: 'development', command: 'serve' })).toBe(false);
    expect(
      (paraglideContext({ enabled: true }).apply as typeof apply)(
        {},
        { mode: 'test', command: 'serve' }
      )
    ).toBe(true);
  });
});

async function waitFor<T>(read: () => Promise<T>, timeout = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    try {
      return await read();
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
