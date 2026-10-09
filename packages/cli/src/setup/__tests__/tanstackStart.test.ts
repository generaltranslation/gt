import * as t from '@babel/types';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tanstackStartSetup } from '../buildTools/tanstackStart/index.js';
import { parseModule } from '../setupViteSPA.js';

// The create-start template, as generated.
const templateRouter = `import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
`;

const configuredRouter = `import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { setupRouterGTIntegration } from 'gt-tanstack-start'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterGTIntegration({ router })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
`;

const templateVite = `import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact()],
})

export default config
`;

const configuredVite = `import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact(), gtTanstackStart()],
})

export default config
`;

const templateRoot = `import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`;

const configuredRoot = templateRoot
  .replace(
    "from '@tanstack/react-router'\n",
    "from '@tanstack/react-router'\nimport { useLocale } from 'gt-tanstack-start'\n"
  )
  .replace('<html lang="en">', '<html lang={useLocale()}>');

// The loader gt init generated before the Vite plugin, for src/_gt.
const templateLoader = `export default async function loadTranslations(locale: string) {
  const translations = await import(\`./_gt/\${locale}.json\`);
  return translations.default;
}
`;

const viteAction = (fix: string) => ({
  whatHappened: 'vite.config.ts was not configured automatically',
  fix: `Add import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite' to vite.config.ts, and add ${fix} to the plugins of defineConfig (see https://generaltranslation.com/docs/react/tanstack-start/setup)`,
});

const rootLangAction = {
  whatHappened: 'src/routes/__root.tsx was not configured automatically',
  fix: "Set <html lang={useLocale()}> in the root route's document component, with import { useLocale } from 'gt-tanstack-start', so the page language follows the resolved locale (see https://generaltranslation.com/docs/react/tanstack-start/setup)",
};

const routerAction = {
  whatHappened: 'src/router.tsx was not configured automatically',
  fix: "Add import { setupRouterGTIntegration } from 'gt-tanstack-start' to src/router.tsx, and call setupRouterGTIntegration({ router }) in getRouter before it returns the router (see https://generaltranslation.com/docs/react/tanstack-start/setup)",
};

describe('tanstackStartSetup', () => {
  let appDirectory: string;
  const file = (name: string) => path.join(appDirectory, name);
  const read = (name: string) => fs.readFileSync(file(name), 'utf8');
  const write = (name: string, content: string) => {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), content);
  };
  const ctx = () => ({
    appDirectory,
    configFilepath: 'gt.config.json',
    defaultLocale: 'en',
    locales: ['es', 'fr'],
    translationsDir: 'src/_gt',
  });
  /** Every file under the app, to prove a run wrote nothing. */
  const snapshot = () =>
    Object.fromEntries(
      (fs.readdirSync(appDirectory, { recursive: true }) as string[])
        .filter((name) => fs.statSync(file(name)).isFile())
        .sort()
        .map((name) => [name, read(name)])
    );

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-tanstack-start-'));
    write('gt.config.json', '{}');
    write('vite.config.ts', templateVite);
    write('src/router.tsx', templateRouter);
    // Tests of the root route's lang write the template's own root.
    write('src/routes/__root.tsx', configuredRoot);
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('configures a create-start app in its own code style', async () => {
    write('src/routes/__root.tsx', templateRoot);

    await tanstackStartSetup.preflight(appDirectory);
    const result = await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(configuredVite);
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(read('src/routes/__root.tsx')).toBe(configuredRoot);
    // The Vite plugin builds the loader from gt.config.json.
    expect(fs.existsSync(file('src/loadTranslations.ts'))).toBe(false);
    expect(fs.existsSync(file('src/start.ts'))).toBe(false);
    expect(read('src/_gt/es.json')).toBe('{}\n');
    expect(read('src/_gt/fr.json')).toBe('{}\n');
    expect(fs.existsSync(file('src/_gt/en.json'))).toBe(false);
    expect(result).toEqual({
      steps: [
        'configured vite.config.ts',
        'configured src/router.tsx',
        'configured src/routes/__root.tsx',
      ],
      manualActions: [],
    });
  });

  it('changes nothing on a rerun', async () => {
    write('src/routes/__root.tsx', templateRoot);
    await tanstackStartSetup.apply(ctx());
    const before = snapshot();

    await tanstackStartSetup.preflight(appDirectory);
    const result = await tanstackStartSetup.apply(ctx());

    expect(snapshot()).toEqual(before);
    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('matches double quotes, semicolons and a multiline plugins array', async () => {
    write(
      'vite.config.mts',
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: { port: 5173 },
  plugins: [
    tanstackStart(),
    react(),
  ],
});
`
    );
    fs.rmSync(file('vite.config.ts'));
    write(
      'src/router.tsx',
      `import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
    const router = createRouter({ routeTree });
    return router;
}
`
    );

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.mts')).toBe(`import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { gtTanstackStart } from "gt-tanstack-start/plugin/vite";

export default defineConfig({
  server: { port: 5173 },
  plugins: [
    tanstackStart(),
    react(),
    gtTanstackStart(),
  ],
});
`);
    expect(read('src/router.tsx'))
      .toBe(`import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupRouterGTIntegration } from "gt-tanstack-start";

export function getRouter() {
    const router = createRouter({ routeTree });
    setupRouterGTIntegration({ router });
    return router;
}
`);
    expect(result.steps).toEqual([
      'configured vite.config.mts',
      'configured src/router.tsx',
    ]);
  });

  it.each([
    [
      'config/gt.config.json',
      "gtTanstackStart({ config: 'config/gt.config.json' })",
    ],
    ['./gt.config.json', 'gtTanstackStart()'],
  ])(
    'passes the config path %s to the plugin only when it is not the default',
    async (configFilepath, call) => {
      await tanstackStartSetup.apply({ ...ctx(), configFilepath });

      expect(read('vite.config.ts')).toBe(
        configuredVite.replace('gtTanstackStart()', call)
      );
    }
  );

  it('adds the plugin to a config exported directly from defineConfig', async () => {
    const direct = (vite: string) =>
      vite
        .replace('const config = defineConfig', 'export default defineConfig')
        .replace('\nexport default config\n', '');
    write('vite.config.ts', direct(templateVite));

    await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(direct(configuredVite));
  });

  it('adds the plugin when gtTanstackStart is only named in a comment', async () => {
    const vite = templateVite.replace(
      'const config = defineConfig',
      '// gtTanstackStart() registers GT below\nconst config = defineConfig'
    );
    write('vite.config.ts', vite);

    await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(
      configuredVite.replace(
        'const config = defineConfig',
        '// gtTanstackStart() registers GT below\nconst config = defineConfig'
      )
    );
  });

  it('adds the plugin to an empty plugins array', async () => {
    write('vite.config.ts', templateVite.replace(/\[.*\]/, '[]'));

    await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toContain('plugins: [gtTanstackStart()],');
  });

  it('calls an existing plugin import under its local name', async () => {
    const vite = templateVite.replace(
      "import viteReact from '@vitejs/plugin-react'\n",
      "import viteReact from '@vitejs/plugin-react'\nimport { gtTanstackStart as gt } from 'gt-tanstack-start/plugin/vite'\n"
    );
    write('vite.config.ts', vite);

    await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(
      vite.replace('viteReact()]', 'viteReact(), gt()]')
    );
  });

  it.each([
    ['without defineConfig', 'export default { plugins: [react()] }\n'],
    [
      'with a defineConfig callback',
      "import { defineConfig } from 'vite'\n\nexport default defineConfig(() => ({ plugins: [] }))\n",
    ],
    [
      'with plugins from a variable',
      "import { defineConfig } from 'vite'\n\nconst plugins = []\n\nexport default defineConfig({ plugins })\n",
    ],
    [
      'exported through a let that could be reassigned',
      "import { defineConfig } from 'vite'\n\nlet config = defineConfig({ plugins: [] })\n\nexport default config\n",
    ],
    [
      // Vite would use the replacement, not the array setup edits.
      'whose plugins are replaced after the config const',
      "import { defineConfig } from 'vite'\n\nconst config = defineConfig({ plugins: [] })\nconfig.plugins = []\n\nexport default config\n",
    ],
    [
      'with a spread that could override plugins',
      "import { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [], ...shared })\n",
    ],
    [
      'with another gtTanstackStart binding',
      "import { defineConfig } from 'vite'\nimport { gtTanstackStart } from './plugins'\n\nexport default defineConfig({ plugins: [] })\n",
    ],
    [
      // Babel ends the element before its closing parenthesis, so appending
      // there would turn it into a comma expression.
      'with a parenthesized last plugin',
      templateVite.replace('viteReact()]', '(viteReact())]'),
    ],
    [
      'that calls the plugin outside a plugins array GT can check',
      "import { defineConfig } from 'vite'\nimport { gtTanstackStart } from 'gt-tanstack-start/plugin/vite'\n\nexport default defineConfig(() => ({ plugins: [gtTanstackStart()] }))\n",
    ],
  ])(
    'asks for the plugin by hand for a Vite config %s and holds the router',
    async (_case, vite) => {
      write('vite.config.ts', vite);
      const before = snapshot();

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: undefined,
      });

      // Without the plugin, setupRouterGTIntegration would fail every page.
      expect(snapshot()).toEqual(before);
      expect(result).toEqual({
        steps: [],
        manualActions: [viteAction('gtTanstackStart()'), routerAction],
      });

      write('vite.config.ts', configuredVite);
      const rerun = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: undefined,
      });

      expect(read('src/router.tsx')).toBe(configuredRouter);
      expect(rerun).toEqual({
        steps: ['configured src/router.tsx'],
        manualActions: [],
      });
    }
  );

  it('names a non-default config path in the manual plugin snippet', async () => {
    write('vite.config.ts', 'export default {}\n');

    const result = await tanstackStartSetup.apply({
      ...ctx(),
      configFilepath: 'config/gt.config.json',
    });

    expect(result.manualActions).toEqual([
      viteAction("gtTanstackStart({ config: 'config/gt.config.json' })"),
      routerAction,
    ]);
  });

  // Setup cannot see the plugin in a callback, so it edits nothing, but every
  // step is listed so following them completes setup.
  it('lists every remaining step for a defineConfig callback that registers the plugin', async () => {
    write(
      'vite.config.ts',
      "import { defineConfig } from 'vite'\nimport { gtTanstackStart } from 'gt-tanstack-start/plugin/vite'\n\nexport default defineConfig(({ mode }) => ({ plugins: [gtTanstackStart()] }))\n"
    );
    write('src/routes/__root.tsx', templateRoot);
    const before = snapshot();

    for (let run = 0; run < 2; run++) {
      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: undefined,
      });

      expect(snapshot()).toEqual(before);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          viteAction('gtTanstackStart()'),
          routerAction,
          rootLangAction,
        ],
      });
    }
  });

  it.each([
    ['a spread', '...gtTanstackStart()'],
    ['a nested array', '[gtTanstackStart()]'],
  ])('accepts the plugin registered through %s', async (_case, plugin) => {
    const vite = configuredVite.replace('gtTanstackStart()]', `${plugin}]`);
    write('vite.config.ts', vite);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(vite);
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(result).toEqual({
      steps: ['configured src/router.tsx'],
      manualActions: [],
    });
  });

  it.each([
    ['gtTanstackStart()', 'gt.config.json'],
    ['gtTanstackStart({ experimentalCompilerOptions: {} })', 'gt.config.json'],
    [
      "gtTanstackStart({ config: 'other/gt.config.json' })",
      'other/gt.config.json',
    ],
    [
      "...gtTanstackStart({ config: 'other/gt.config.json' })",
      'other/gt.config.json',
    ],
  ])(
    'asks to pass a new config path to a registered %s',
    async (call, current) => {
      const vite = configuredVite.replace('gtTanstackStart()', call);
      write('vite.config.ts', vite);

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        configFilepath: 'config/gt.config.json',
      });

      expect(read('vite.config.ts')).toBe(vite);
      expect(read('src/router.tsx')).toBe(configuredRouter);
      expect(result).toEqual({
        steps: ['configured src/router.tsx'],
        manualActions: [
          {
            whatHappened: `vite.config.ts was left unchanged, but its gtTanstackStart() call reads ${current} instead of config/gt.config.json`,
            fix: "Set the config option of the gtTanstackStart() call in vite.config.ts to 'config/gt.config.json', keeping its other options (see https://generaltranslation.com/docs/react/tanstack-start/setup)",
          },
        ],
      });
    }
  );

  it.each([
    ["gtTanstackStart({ config: './config/gt.config.json' })"],
    [
      "gtTanstackStart({ experimentalCompilerOptions: {}, 'config': 'config/gt.config.json' })",
    ],
    // The path is only known at runtime, so GT cannot tell it is stale.
    ["gtTanstackStart({ config: process.env.GT_CONFIG ?? 'gt.config.json' })"],
    ['gtTanstackStart({ ...shared })'],
    ['gtTanstackStart(options)'],
  ])('accepts a registered %s for a non-default config path', async (call) => {
    const vite = configuredVite.replace('gtTanstackStart()', call);
    write('vite.config.ts', vite);

    const result = await tanstackStartSetup.apply({
      ...ctx(),
      configFilepath: 'config/gt.config.json',
    });

    expect(read('vite.config.ts')).toBe(vite);
    expect(result).toEqual({
      steps: ['configured src/router.tsx'],
      manualActions: [],
    });
  });

  it.skipIf(process.platform === 'win32').each([
    ['single', templateVite],
    ['double', templateVite.replace(/'/g, '"')],
  ])(
    'writes a config path with quotes and a backslash as a %s-quoted string',
    async (_quote, vite) => {
      write('vite.config.ts', vite);
      const configFilepath = 'config/it\'s "a"\\gt.config.json';

      await tanstackStartSetup.apply({ ...ctx(), configFilepath });

      const statements = parseModule(read('vite.config.ts'), 'vite.config.ts');
      const configs: unknown[] = [];
      for (const statement of statements ?? []) {
        t.traverseFast(statement, (node) => {
          if (
            node.type === 'CallExpression' &&
            t.isIdentifier(node.callee, { name: 'gtTanstackStart' }) &&
            node.arguments[0]?.type === 'ObjectExpression'
          ) {
            const [property] = node.arguments[0].properties;
            if (property.type === 'ObjectProperty') {
              configs.push((property.value as t.StringLiteral).value);
            }
          }
        });
      }
      expect(configs).toEqual([configFilepath]);
    }
  );

  it.each([
    [
      'returns createRouter directly',
      "import { createRouter } from '@tanstack/react-router'\n\nexport function getRouter() {\n  return createRouter({ routeTree })\n}\n",
    ],
    [
      'creates the router with let',
      "import { createRouter } from '@tanstack/react-router'\n\nexport function getRouter() {\n  let router = createRouter({ routeTree })\n  return router\n}\n",
    ],
    [
      'has no getRouter',
      "import { createRouter } from '@tanstack/react-router'\n\nexport const router = createRouter({ routeTree })\n",
    ],
    [
      'returns the router after code on the same line',
      "import { createRouter } from '@tanstack/react-router'\n\nexport function getRouter() {\n  const router = createRouter({ routeTree }); return router\n}\n",
    ],
    [
      'returns early',
      "import { createRouter } from '@tanstack/react-router'\n\nexport function getRouter() {\n  const router = createRouter({ routeTree })\n  if (import.meta.env.SSR) return router\n  return router\n}\n",
    ],
    [
      'integrates the router only on an early return',
      "import { createRouter } from '@tanstack/react-router'\nimport { setupRouterGTIntegration } from 'gt-tanstack-start'\n\nexport function getRouter() {\n  const router = createRouter({ routeTree })\n  if (import.meta.env.SSR) {\n    setupRouterGTIntegration({ router })\n    return router\n  }\n  return router\n}\n",
    ],
  ])(
    'asks for the router call by hand when the router %s',
    async (_case, router) => {
      write('src/router.tsx', router);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/router.tsx')).toBe(router);
      expect(read('vite.config.ts')).toBe(configuredVite);
      expect(result).toEqual({
        steps: ['configured vite.config.ts'],
        manualActions: [routerAction],
      });
    }
  );

  it('configures getRouter declared as an arrow function', async () => {
    write(
      'src/router.tsx',
      "import { createRouter } from '@tanstack/react-router'\n\nexport const getRouter = () => {\n  const router = createRouter({ routeTree })\n  return router\n}\n"
    );

    await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(
      "import { createRouter } from '@tanstack/react-router'\nimport { setupRouterGTIntegration } from 'gt-tanstack-start'\n\nexport const getRouter = () => {\n  const router = createRouter({ routeTree })\n  setupRouterGTIntegration({ router })\n  return router\n}\n"
    );
  });

  it('asks for review when setupRouterGTIntegration gets a router getRouter does not return', async () => {
    const router = configuredRouter
      .replace(
        '  setupRouterGTIntegration({ router })\n  return router',
        '  return router'
      )
      .replace(
        'export function getRouter() {',
        'export function getRouter() {\n  setupRouterGTIntegration({ router: createTanStackRouter({ routeTree }) })'
      );
    write('src/router.tsx', router);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(router);
    expect(result).toEqual({
      steps: ['configured vite.config.ts'],
      manualActions: [routerAction],
    });
  });

  it('calls an existing setupRouterGTIntegration import under its local name', async () => {
    const router = templateRouter.replace(
      "from './routeTree.gen'\n",
      "from './routeTree.gen'\nimport { setupRouterGTIntegration as setupGT } from 'gt-tanstack-start'\n"
    );
    write('src/router.tsx', router);

    await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(
      router.replace(
        '  return router',
        '  setupGT({ router })\n  return router'
      )
    );
  });

  it('asks for review when a local value hides the setupRouterGTIntegration import', async () => {
    const router = templateRouter
      .replace(
        "from './routeTree.gen'\n",
        "from './routeTree.gen'\nimport { setupRouterGTIntegration as setupGT } from 'gt-tanstack-start'\n"
      )
      .replace(
        'export function getRouter() {\n',
        "export function getRouter() {\n  const setupGT = 'custom'\n"
      );
    write('src/router.tsx', router);

    const result = await tanstackStartSetup.apply(ctx());

    // `setupGT({ router })` would call the string.
    expect(read('src/router.tsx')).toBe(router);
    expect(result).toEqual({
      steps: ['configured vite.config.ts'],
      manualActions: [routerAction],
    });
  });

  it('asks for review when a spread could replace the integrated router', async () => {
    const router = configuredRouter.replace(
      'setupRouterGTIntegration({ router })',
      'setupRouterGTIntegration({ router, ...{ router: other } })'
    );
    write('src/router.tsx', router);
    write('vite.config.ts', configuredVite);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(router);
    expect(result).toEqual({ steps: [], manualActions: [routerAction] });
  });

  describe('the root route lang', () => {
    it.each([
      [
        'replaces a hard-coded lang',
        '<html lang="en">',
        '<html lang={useLocale()}>',
      ],
      ['adds a missing lang', '<html>', '<html lang={useLocale()}>'],
      [
        'replaces a hard-coded lang in braces',
        "<html lang={'en'}>",
        '<html lang={useLocale()}>',
      ],
    ])('%s with the resolved locale', async (_case, html, expected) => {
      write(
        'src/routes/__root.tsx',
        templateRoot.replace('<html lang="en">', html)
      );

      await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(
        configuredRoot.replace('<html lang={useLocale()}>', expected)
      );
    });

    it('sets the lang an arrow function component returns', async () => {
      const arrow = (root: string) =>
        root
          .replace(
            'function RootDocument({ children }: { children: React.ReactNode }) {\n  return (',
            'const RootDocument = ({ children }: { children: React.ReactNode }) => ('
          )
          .replace('  )\n}\n', ')\n');
      write('src/routes/__root.tsx', arrow(templateRoot));

      await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(arrow(configuredRoot));
    });

    it('sets the lang when useLocale is only named in a comment', async () => {
      const comment = (root: string) =>
        root.replace(
          'function RootDocument',
          '// The document reads useLocale() once GT is set up\nfunction RootDocument'
        );
      write('src/routes/__root.tsx', comment(templateRoot));

      await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(comment(configuredRoot));
    });

    it('calls an existing useLocale import under its local name', async () => {
      const root = templateRoot.replace(
        "from '@tanstack/react-router'\n",
        "from '@tanstack/react-router'\nimport { useLocale as useGTLocale } from 'gt-tanstack-start'\n"
      );
      write('src/routes/__root.tsx', root);

      await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(
        root.replace('<html lang="en">', '<html lang={useGTLocale()}>')
      );
    });

    it('leaves a computed lang to the app', async () => {
      const root = templateRoot.replace(
        '<html lang="en">',
        '<html lang={locale}>'
      );
      write('src/routes/__root.tsx', root);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(root);
      expect(result).toEqual({
        steps: ['configured vite.config.ts', 'configured src/router.tsx'],
        manualActions: [],
      });
    });

    it.each([
      [
        'spread attributes',
        templateRoot.replace('<html lang="en">', '<html {...props} lang="en">'),
      ],
      [
        'another useLocale binding',
        templateRoot.replace(
          "from '@tanstack/react-router'\n",
          "from '@tanstack/react-router'\nimport { useLocale } from './locale'\n"
        ),
      ],
      [
        // `lang={locale()}` would call the component's string.
        'a useLocale import shadowed in the component',
        templateRoot
          .replace(
            "from '@tanstack/react-router'\n",
            "from '@tanstack/react-router'\nimport { useLocale as locale } from 'gt-tanstack-start'\n"
          )
          .replace(
            '  return (\n    <html',
            "  const locale = 'en'\n  return (\n    <html"
          ),
      ],
      [
        // A hook there would run while the module loads, outside React.
        'an html element outside a component',
        'import { createRootRoute } from \'@tanstack/react-router\'\n\nconst document = <html lang="en"><body>Static page</body></html>\nexport const Route = createRootRoute({ component: RootDocument })\nfunction RootDocument() { return document }\n',
      ],
      [
        // A hook there would only run on some renders.
        'an html element after an early return',
        templateRoot.replace(
          '  return (\n    <html',
          '  if (!children) return null\n  return (\n    <html'
        ),
      ],
      [
        // Calling it outside a render would run the hook outside React.
        'a document component called directly',
        'import { createRootRoute } from \'@tanstack/react-router\'\n\nfunction RootDocument() {\n  return <html lang="en"><body /></html>\n}\nconst doc = RootDocument()\n\nexport const Route = createRootRoute({ shellComponent: () => doc })\n',
      ],
      [
        'an inline shell component',
        'import { createRootRoute } from \'@tanstack/react-router\'\n\nexport const Route = createRootRoute({\n  shellComponent: ({ children }) => <html lang="en"><body>{children}</body></html>,\n})\n',
      ],
    ])('asks for the lang by hand for a root with %s', async (_case, root) => {
      write('src/routes/__root.tsx', root);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(root);
      expect(result).toEqual({
        steps: ['configured vite.config.ts', 'configured src/router.tsx'],
        manualActions: [rootLangAction],
      });
    });

    it.each([
      [
        'imports its document from another file',
        "import { createRootRoute } from '@tanstack/react-router'\nimport { RootDocument } from '../document'\n\nexport const Route = createRootRoute({ shellComponent: RootDocument })\n",
      ],
      ['cannot be parsed', 'export const Route = <html lang="en">\n'],
    ])(
      'reminds about the lang during setup when the root %s',
      async (_case, root) => {
        write('src/routes/__root.tsx', root);

        const result = await tanstackStartSetup.apply(ctx());

        expect(read('src/routes/__root.tsx')).toBe(root);
        expect(result.manualActions).toEqual([rootLangAction]);

        // A rerun cannot see whether the document was fixed.
        await expect(tanstackStartSetup.apply(ctx())).resolves.toEqual({
          steps: [],
          manualActions: [],
        });
      }
    );

    it('leaves the root unchanged until the router is integrated', async () => {
      write('vite.config.ts', 'export default { plugins: [] }\n');
      write('src/routes/__root.tsx', templateRoot);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/routes/__root.tsx')).toBe(templateRoot);
      expect(result.manualActions).toEqual([
        viteAction('gtTanstackStart()'),
        routerAction,
        rootLangAction,
      ]);
    });
  });

  it('leaves a router that integrates the router getRouter returns', async () => {
    const router = configuredRouter.replace(
      'setupRouterGTIntegration({ router })',
      'setupRouterGTIntegration({ router: router, localeRewrite: false })'
    );
    write('src/router.tsx', router);
    write('vite.config.ts', configuredVite);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(router);
    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('adds the plugin when gtTanstackStart is only called outside the plugins array', async () => {
    const vite = configuredVite
      .replace('viteReact(), gtTanstackStart()]', 'viteReact()]')
      .replace(
        'export default',
        'const unused = gtTanstackStart()\n\nexport default'
      );
    write('vite.config.ts', vite);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(
      vite.replace('viteReact()]', 'viteReact(), gtTanstackStart()]')
    );
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(result.steps).toEqual([
      'configured vite.config.ts',
      'configured src/router.tsx',
    ]);
  });

  it('adds the plugin when the plugins array only calls gtTanstackStart conditionally', async () => {
    const vite = configuredVite.replace(
      'viteReact(), gtTanstackStart()]',
      'viteReact(), false && gtTanstackStart()]'
    );
    write('vite.config.ts', vite);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('vite.config.ts')).toBe(
      vite.replace(
        'false && gtTanstackStart()]',
        'false && gtTanstackStart(), gtTanstackStart()]'
      )
    );
    expect(result.steps).toEqual([
      'configured vite.config.ts',
      'configured src/router.tsx',
    ]);
  });

  it('keeps a same-line comment on the last import', async () => {
    write(
      'src/router.tsx',
      templateRouter.replace(
        "from './routeTree.gen'",
        "from './routeTree.gen' // eslint-disable-line"
      )
    );

    await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(
      configuredRouter.replace(
        "from './routeTree.gen'",
        "from './routeTree.gen' // eslint-disable-line"
      )
    );
  });

  describe('the previous setup', () => {
    // The router the previous gt init generated.
    const previousRouter = `import { createRouter } from '@tanstack/react-router'
import { initializeGT } from 'gt-tanstack-start'
import gtConfig from '../gt.config.json'
import loadTranslations from './loadTranslations'
import { routeTree } from './routeTree.gen'

initializeGT({ ...gtConfig, loadTranslations })

export function getRouter() {
  const router = createRouter({ routeTree })

  return router
}
`;

    it.each([
      ['initializeGT in src/router.tsx', 'src/router.tsx', previousRouter],
      [
        'gtMiddleware in src/start.ts',
        'src/start.ts',
        "import { createStart } from '@tanstack/react-start'\nimport { gtMiddleware } from 'gt-tanstack-start'\n\nexport const startInstance = createStart(() => ({ requestMiddleware: [gtMiddleware] }))\n",
      ],
      [
        'GTProvider in src/routes/__root.tsx',
        'src/routes/__root.tsx',
        templateRoot.replace(
          '{children}',
          '<GTProvider locale="en">{children}</GTProvider>'
        ),
      ],
      [
        'initializeGT in src/router.tsx',
        'src/router.tsx',
        // An unparseable router falls back to a text check.
        `${previousRouter}\nexport default class { @dec() x }\n`,
      ],
      [
        'GTProvider in src/routes/__root.tsx',
        'src/routes/__root.tsx',
        templateRoot
          .replace(
            "from '@tanstack/react-router'\n",
            "from '@tanstack/react-router'\nimport { GTProvider as Provider } from 'gt-tanstack-start'\n"
          )
          .replace('{children}', '<Provider locale="en">{children}</Provider>'),
      ],
    ])(
      'leaves the app source unchanged for %s',
      async (marker, previousFile, content) => {
        write(previousFile, content);
        const before = snapshot();

        const result = await tanstackStartSetup.apply({
          ...ctx(),
          translationsDir: undefined,
        });

        expect(snapshot()).toEqual(before);
        expect(result).toEqual({
          steps: [],
          manualActions: [
            {
              whatHappened: `This app uses the previous gt-tanstack-start setup (${marker}), so GT left its source files unchanged`,
              fix: 'Keep the previous setup, which still works, or switch to setupRouterGTIntegration and the gtTanstackStart Vite plugin (see https://generaltranslation.com/docs/react/tanstack-start/setup)',
            },
          ],
        });
      }
    );

    it('leaves a namespace-import setup unchanged', async () => {
      write(
        'src/router.tsx',
        previousRouter
          .replace(
            "import { initializeGT } from 'gt-tanstack-start'",
            "import * as GT from 'gt-tanstack-start'"
          )
          .replace('initializeGT({', 'GT.initializeGT({')
      );
      write(
        'src/start.ts',
        "import { createStart } from '@tanstack/react-start'\nimport * as GT from 'gt-tanstack-start'\n\nexport const startInstance = createStart(() => ({ requestMiddleware: [GT.gtMiddleware] }))\n"
      );
      write(
        'src/routes/__root.tsx',
        templateRoot
          .replace(
            "from '@tanstack/react-router'\n",
            "from '@tanstack/react-router'\nimport * as GT from 'gt-tanstack-start'\n"
          )
          .replace(
            '{children}',
            '<GT.GTProvider locale="en">{children}</GT.GTProvider>'
          )
      );
      const before = snapshot();

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: undefined,
      });

      expect(snapshot()).toEqual(before);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          {
            whatHappened:
              'This app uses the previous gt-tanstack-start setup (initializeGT in src/router.tsx, gtMiddleware in src/start.ts, GTProvider in src/routes/__root.tsx), so GT left its source files unchanged',
            fix: 'Keep the previous setup, which still works, or switch to setupRouterGTIntegration and the gtTanstackStart Vite plugin (see https://generaltranslation.com/docs/react/tanstack-start/setup)',
          },
        ],
      });
    });

    it('configures a new app that mentions GTProvider beside a namespace import', async () => {
      write(
        'src/routes/__root.tsx',
        templateRoot
          .replace(
            "from '@tanstack/react-router'\n",
            "from '@tanstack/react-router'\nimport * as GT from 'gt-tanstack-start'\n\n// GTProvider is rendered by setupRouterGTIntegration.\n"
          )
          .replace('{children}', '<GT.T>{children}</GT.T>')
      );

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/router.tsx')).toBe(configuredRouter);
      expect(result.steps).toContain('configured src/router.tsx');
    });

    describe('initializing GT for CDN translations', () => {
      // The router the previous gt init generated for CDN storage.
      const cdnRouter = previousRouter
        .replace("import loadTranslations from './loadTranslations'\n", '')
        .replace(
          'initializeGT({ ...gtConfig, loadTranslations })',
          'initializeGT(gtConfig)'
        );
      const storageAction = {
        whatHappened:
          'src/router.tsx initializes GT for CDN translations, but translations are now stored in src/_gt',
        fix: "Pass loadTranslations to the initializeGT call in src/router.tsx, such as initializeGT({ ...gtConfig, loadTranslations }), and add import loadTranslations from './loadTranslations' (see https://generaltranslation.com/docs/react/tanstack-start/setup)",
      };

      it('creates the loader and asks to pass it when configure switches to local files', async () => {
        write('src/router.tsx', cdnRouter);

        const result = await tanstackStartSetup.syncLoader(ctx());

        expect(read('src/router.tsx')).toBe(cdnRouter);
        expect(read('src/loadTranslations.ts')).toBe(templateLoader);
        expect(read('src/_gt/es.json')).toBe('{}\n');
        expect(result).toEqual({
          steps: ['created src/loadTranslations.ts'],
          manualActions: [storageAction],
        });
      });

      it('creates the loader and asks to pass it when init stores files locally', async () => {
        write('src/router.tsx', cdnRouter);

        const result = await tanstackStartSetup.apply(ctx());

        expect(read('src/router.tsx')).toBe(cdnRouter);
        expect(read('vite.config.ts')).toBe(templateVite);
        expect(read('src/loadTranslations.ts')).toBe(templateLoader);
        expect(result).toEqual({
          steps: ['created src/loadTranslations.ts'],
          manualActions: [
            storageAction,
            expect.objectContaining({
              whatHappened: expect.stringContaining(
                'This app uses the previous gt-tanstack-start setup'
              ),
            }),
          ],
        });
      });

      it('names the export of an existing custom loader', async () => {
        write('src/router.tsx', cdnRouter);
        write(
          'src/loadTranslations.ts',
          'export async function loadTranslations(locale: string) { return {}; }\n'
        );

        const result = await tanstackStartSetup.syncLoader({
          ...ctx(),
          previousTranslationsDir: 'src/_gt',
        });

        expect(result).toEqual({
          steps: [],
          manualActions: [
            {
              ...storageAction,
              fix: storageAction.fix.replace(
                'import loadTranslations from',
                'import { loadTranslations } from'
              ),
            },
          ],
        });
      });
    });

    it('keeps its template loader in sync with the translations directory', async () => {
      write('src/router.tsx', previousRouter);
      write('src/loadTranslations.ts', templateLoader);

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
      });

      expect(read('src/router.tsx')).toBe(previousRouter);
      expect(read('vite.config.ts')).toBe(templateVite);
      expect(read('src/loadTranslations.ts')).toContain('../public/_gt/');
      expect(result.steps).toEqual(['updated src/loadTranslations.ts']);
      expect(result.manualActions).toHaveLength(1);
    });

    it('asks to drop the initializeGT loader after a switch to the CDN', async () => {
      write('src/router.tsx', previousRouter);
      write('src/loadTranslations.ts', templateLoader);

      const action = await tanstackStartSetup.getCDNStorageAction!({
        ...ctx(),
        translationsDir: undefined,
        previousTranslationsDir: 'src/_gt',
      });

      expect(action).toEqual({
        whatHappened:
          'Translations now load from the CDN, but initializeGT in src/router.tsx may still receive the local loader for src/_gt',
        fix: 'Remove the loadTranslations option and its import from the initializeGT() call so translations load from the CDN',
      });
    });

    it('reports nothing for a previous-setup router that already loads from the CDN', async () => {
      write(
        'src/router.tsx',
        previousRouter
          .replace("import loadTranslations from './loadTranslations'\n", '')
          .replace(
            'initializeGT({ ...gtConfig, loadTranslations })',
            'initializeGT(gtConfig)'
          )
      );
      write('src/loadTranslations.ts', templateLoader);

      await expect(
        tanstackStartSetup.getCDNStorageAction!({
          ...ctx(),
          translationsDir: undefined,
          previousTranslationsDir: 'src/_gt',
        })
      ).resolves.toBeNull();
    });

    it('names the loader initializeGT may receive for CDN storage without a previous output', async () => {
      write('src/router.tsx', previousRouter);
      write('src/loadTranslations.ts', templateLoader);

      const action = await tanstackStartSetup.getCDNStorageAction!({
        ...ctx(),
        translationsDir: undefined,
      });

      expect(action).toEqual({
        whatHappened:
          'Translations now load from the CDN, but initializeGT in src/router.tsx may still receive the local loader in src/loadTranslations.ts',
        fix: 'Remove the loadTranslations option and its import from the initializeGT() call so translations load from the CDN',
      });
    });
  });

  describe('translation loaders', () => {
    it('refreshes a template loader for a new translations directory', async () => {
      write('src/loadTranslations.ts', templateLoader);
      await tanstackStartSetup.apply(ctx());

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
      });

      expect(read('src/loadTranslations.ts')).toBe(
        templateLoader.replace('./_gt/', '../public/_gt/')
      );
      expect(read('public/_gt/es.json')).toBe('{}\n');
      expect(result).toEqual({
        steps: ['updated src/loadTranslations.ts'],
        manualActions: [],
      });
    });

    it('preserves a custom loader and asks to update it once', async () => {
      const loader =
        'export async function loadTranslations(locale: string) { return {}; }\n';
      write('src/loadTranslations.ts', loader);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/loadTranslations.ts')).toBe(loader);
      expect(read('src/router.tsx')).toBe(configuredRouter);
      expect(result.manualActions).toEqual([
        {
          whatHappened:
            'Your custom src/loadTranslations.ts was left unchanged, but translations now go to src/_gt',
          fix: 'Update your custom src/loadTranslations.ts to load translations from src/_gt',
        },
      ]);

      const rerun = await tanstackStartSetup.apply({
        ...ctx(),
        previousTranslationsDir: 'src/_gt',
      });

      expect(rerun).toEqual({ steps: [], manualActions: [] });
    });

    const exportAction = (loader: string) => ({
      whatHappened: `Your custom ${loader} has no default or named loadTranslations export, so gt-tanstack-start cannot load translations with it`,
      fix: `Update your custom ${loader} to export a default or named loadTranslations function`,
    });

    it.each(['src/loadTranslations.ts', 'src/loadTranslations.jsx'])(
      'asks for a loadTranslations export from %s on every run',
      async (loader) => {
        const content = 'export const translations = {};\n';
        write(loader, content);

        const result = await tanstackStartSetup.apply({
          ...ctx(),
          previousTranslationsDir: 'src/_gt',
        });

        expect(read(loader)).toBe(content);
        expect(read('src/router.tsx')).toBe(configuredRouter);
        expect(result).toEqual({
          steps: ['configured vite.config.ts', 'configured src/router.tsx'],
          manualActions: [exportAction(loader)],
        });

        const rerun = await tanstackStartSetup.apply({
          ...ctx(),
          previousTranslationsDir: 'src/_gt',
        });

        expect(rerun).toEqual({
          steps: [],
          manualActions: [exportAction(loader)],
        });
      }
    );

    it('asks for a loadTranslations export when configure syncs files', async () => {
      write('src/loadTranslations.js', 'module.exports = {};\n');
      const before = snapshot();

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        previousTranslationsDir: 'src/_gt',
      });

      expect(snapshot()).toEqual({
        ...before,
        'src/_gt/es.json': '{}\n',
        'src/_gt/fr.json': '{}\n',
      });
      expect(result).toEqual({
        steps: [],
        manualActions: [exportAction('src/loadTranslations.js')],
      });
    });

    it('checks only the loader the Vite plugin uses', async () => {
      write('src/loadTranslations.ts', templateLoader);
      write('src/loadTranslations.js', 'export const translations = {};\n');

      const result = await tanstackStartSetup.syncLoader(ctx());

      expect(result).toEqual({
        steps: [],
        manualActions: [
          expect.objectContaining({
            fix: 'Update your custom src/loadTranslations.js to load translations from src/_gt',
          }),
        ],
      });
    });

    it('reads the export of a JSX loader', async () => {
      write(
        'src/loadTranslations.tsx',
        'const note = <p />;\nexport async function loadTranslations(locale: string) { return {}; }\n'
      );

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        previousTranslationsDir: 'src/_gt',
      });

      expect(result).toEqual({ steps: [], manualActions: [] });
    });

    it('refreshes a template loader and names another loader for a new translations directory', async () => {
      write('src/loadTranslations.ts', templateLoader);
      write('src/loadTranslations.js', templateLoader);

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
      });

      expect(read('src/loadTranslations.ts')).toBe(
        templateLoader.replace('./_gt/', '../public/_gt/')
      );
      expect(read('src/loadTranslations.js')).toBe(templateLoader);
      expect(result).toEqual({
        steps: ['updated src/loadTranslations.ts'],
        manualActions: [
          {
            whatHappened:
              'Your custom src/loadTranslations.js was left unchanged, but translations now go to public/_gt',
            fix: 'Update your custom src/loadTranslations.js to load translations from public/_gt',
          },
        ],
      });
    });

    it('names a .js loader for a new translations directory', async () => {
      write('src/loadTranslations.js', templateLoader);

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
      });

      expect(read('src/loadTranslations.js')).toBe(templateLoader);
      expect(read('public/_gt/es.json')).toBe('{}\n');
      expect(result).toEqual({
        steps: [],
        manualActions: [
          {
            whatHappened:
              'Your custom src/loadTranslations.js was left unchanged, but translations now go to public/_gt',
            fix: 'Update your custom src/loadTranslations.js to load translations from public/_gt',
          },
        ],
      });
    });

    it('names every leftover loader after a switch to the CDN', async () => {
      write('src/loadTranslations.ts', templateLoader);
      write('src/loadTranslations.js', templateLoader);

      const action = await tanstackStartSetup.getCDNStorageAction!({
        ...ctx(),
        translationsDir: undefined,
        previousTranslationsDir: 'src/_gt',
      });

      // Deleting only the first would make the Vite plugin use the next.
      expect(action).toEqual({
        whatHappened:
          'Translations now load from the CDN, but gt-tanstack-start still loads them with src/loadTranslations.ts, src/loadTranslations.js',
        fix: 'Delete src/loadTranslations.ts, src/loadTranslations.js so translations load from the CDN',
      });
    });

    it.each(['src/loadTranslations.ts', 'src/loadTranslations.js'])(
      'names a leftover %s after a switch to the CDN',
      async (loader) => {
        write(loader, templateLoader);

        const result = await tanstackStartSetup.apply({
          ...ctx(),
          translationsDir: undefined,
          previousTranslationsDir: 'src/_gt',
        });

        // The Vite plugin uses the loader over the CDN.
        expect(read(loader)).toBe(templateLoader);
        expect(result).toEqual({
          steps: ['configured vite.config.ts', 'configured src/router.tsx'],
          manualActions: [
            {
              whatHappened: `Translations now load from the CDN, but gt-tanstack-start still loads them with ${loader}`,
              fix: `Delete ${loader} so translations load from the CDN`,
            },
          ],
        });
      }
    );

    it.each(['src/loadTranslations.ts', 'src/loadTranslations.js'])(
      'names a leftover %s for CDN storage without a previous output',
      async (loader) => {
        write(loader, templateLoader);
        const cdnCtx = { ...ctx(), translationsDir: undefined };
        const action = {
          whatHappened: `Translations now load from the CDN, but gt-tanstack-start still loads them with ${loader}`,
          fix: `Delete ${loader} so translations load from the CDN`,
        };

        const result = await tanstackStartSetup.apply(cdnCtx);

        expect(read(loader)).toBe(templateLoader);
        expect(result.manualActions).toEqual([action]);
        await expect(
          tanstackStartSetup.getCDNStorageAction!(cdnCtx)
        ).resolves.toEqual(action);
      }
    );

    it('reports nothing for a CDN switch without a leftover loader', async () => {
      await expect(
        tanstackStartSetup.getCDNStorageAction!({
          ...ctx(),
          translationsDir: undefined,
          previousTranslationsDir: 'src/_gt',
        })
      ).resolves.toBeNull();
    });

    it('adds locale stubs without a loader when configure syncs files', async () => {
      const result = await tanstackStartSetup.syncLoader(ctx());

      expect(read('src/_gt/es.json')).toBe('{}\n');
      expect(fs.existsSync(file('src/loadTranslations.ts'))).toBe(false);
      expect(read('src/router.tsx')).toBe(templateRouter);
      expect(result).toEqual({ steps: [], manualActions: [] });
    });

    it('names a .js loader when init keeps the app source', async () => {
      write('src/loadTranslations.js', templateLoader);
      const before = snapshot();

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
        keepAppSource: true,
      });

      expect(snapshot()).toEqual(before);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          {
            whatHappened:
              'src/loadTranslations.js was left unchanged because the React setup was skipped, but translations now go to public/_gt',
            fix: 'Update src/loadTranslations.js to load translations from public/_gt',
          },
        ],
      });
    });

    it('changes no files when init keeps the app source', async () => {
      write('src/loadTranslations.ts', templateLoader);
      const before = snapshot();

      const result = await tanstackStartSetup.syncLoader({
        ...ctx(),
        translationsDir: 'public/_gt',
        previousTranslationsDir: 'src/_gt',
        keepAppSource: true,
      });

      expect(snapshot()).toEqual(before);
      expect(result.manualActions).toEqual([
        expect.objectContaining({
          fix: 'Update src/loadTranslations.ts to load translations from public/_gt',
        }),
      ]);
    });
  });

  it('configures an app without a root route', async () => {
    fs.rmSync(file('src/routes/__root.tsx'));

    await tanstackStartSetup.preflight(appDirectory);
    const result = await tanstackStartSetup.apply(ctx());

    expect(result.steps).toEqual([
      'configured vite.config.ts',
      'configured src/router.tsx',
    ]);
  });

  it.each(['src/router.tsx', 'vite.config.ts'])(
    'rejects an app without %s before any change',
    async (missing) => {
      fs.rmSync(file(missing));
      const before = snapshot();

      await expect(tanstackStartSetup.preflight(appDirectory)).rejects.toThrow(
        `${missing} was not found`
      );
      expect(snapshot()).toEqual(before);
    }
  );
});
