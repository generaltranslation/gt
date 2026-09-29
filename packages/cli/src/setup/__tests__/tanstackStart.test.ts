import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tanstackStartSetup } from '../buildTools/tanstackStart.js';

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

const templateRoot = `import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
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

const configuredRouter = `import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { initializeGT } from 'gt-tanstack-start'
import gtConfig from '../gt.config.json'
import loadTranslations from './loadTranslations'

initializeGT({ ...gtConfig, loadTranslations })

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

const configuredRoot = `import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { GTProvider, getLocale, getTranslationsSnapshot } from 'gt-tanstack-start'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  loader: async () => {
    const locale = getLocale()
    return { locale, translations: await getTranslationsSnapshot(locale) }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale, translations } = Route.useLoaderData()
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <GTProvider locale={locale} translations={translations}>
          {children}
        </GTProvider>

        <Scripts />
      </body>
    </html>
  )
}
`;

const generatedStart = `import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from 'gt-tanstack-start';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
`;

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
    write('src/router.tsx', templateRouter);
    write('src/routes/__root.tsx', templateRoot);
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('configures a create-start app in its own code style', async () => {
    await tanstackStartSetup.preflight(appDirectory);
    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(read('src/routes/__root.tsx')).toBe(configuredRoot);
    expect(read('src/start.ts')).toBe(generatedStart);
    expect(read('src/loadTranslations.ts')).toContain(
      'import(`./_gt/${locale}.json`)'
    );
    expect(read('src/_gt/es.json')).toBe('{}\n');
    expect(read('src/_gt/fr.json')).toBe('{}\n');
    expect(fs.existsSync(file('src/_gt/en.json'))).toBe(false);
    expect(result).toEqual({
      steps: [
        'created src/start.ts',
        'configured src/router.tsx',
        'configured src/routes/__root.tsx',
      ],
      manualActions: [],
    });
  });

  it('changes nothing on a rerun', async () => {
    await tanstackStartSetup.apply(ctx());
    const before = snapshot();

    await tanstackStartSetup.preflight(appDirectory);
    const result = await tanstackStartSetup.apply(ctx());

    expect(snapshot()).toEqual(before);
    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('matches double quotes and semicolons in the router', async () => {
    write(
      'src/router.tsx',
      'import { createRouter } from "@tanstack/react-router";\n\nexport function getRouter() {}\n'
    );

    await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx'))
      .toBe(`import { createRouter } from "@tanstack/react-router";
import { initializeGT } from "gt-tanstack-start";
import gtConfig from "../gt.config.json";
import loadTranslations from "./loadTranslations";

initializeGT({ ...gtConfig, loadTranslations });

export function getRouter() {}
`);
  });

  it('initializes from the CDN without a translations directory', async () => {
    await tanstackStartSetup.apply({ ...ctx(), translationsDir: undefined });

    expect(read('src/router.tsx')).toContain('initializeGT(gtConfig)\n');
    expect(read('src/router.tsx')).not.toContain('loadTranslations');
    expect(fs.existsSync(file('src/loadTranslations.ts'))).toBe(false);
  });

  it('asks for gtMiddleware in an existing start entry', async () => {
    const start = `import { createStart } from '@tanstack/react-start';

export const startInstance = createStart(() => ({}));
`;
    write('src/start.ts', start);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/start.ts')).toBe(start);
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(result.manualActions).toEqual([
      {
        whatHappened: 'src/start.ts does not use gtMiddleware',
        fix: expect.stringContaining('keeping your existing middleware'),
      },
    ]);
  });

  it.each([
    [
      'an existing loader',
      templateRoot.replace(
        '  shellComponent: RootDocument,',
        '  loader: () => ({}),\n  shellComponent: RootDocument,'
      ),
    ],
    [
      'an expression lang',
      templateRoot.replace('lang="en"', 'lang={getLang()}'),
    ],
    [
      'a component without an html shell',
      templateRoot
        .replace('shellComponent', 'component')
        .replace(/<html[\s\S]*<\/html>/, '<Outlet />'),
    ],
    [
      'an imported shell',
      templateRoot.replace(/function RootDocument/, 'function Other'),
    ],
    ['a syntax error', `${templateRoot}\n<`],
    [
      'a beforeLoad',
      templateRoot.replace(
        '  shellComponent: RootDocument,',
        '  beforeLoad: () => {},\n  shellComponent: RootDocument,'
      ),
    ],
  ])('leaves a root route with %s for manual review', async (_case, root) => {
    write('src/routes/__root.tsx', root);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(root);
    expect(result.manualActions).toEqual([
      {
        whatHappened:
          'src/routes/__root.tsx does not match the create-start root route',
        fix: expect.stringContaining('<GTProvider locale={locale}'),
      },
    ]);
  });

  it.each([
    [
      'a comment',
      '// TODO: wire gtMiddleware\nexport const startInstance = createStart(() => ({}));\n',
    ],
    [
      'an unused import',
      "import { gtMiddleware } from 'gt-tanstack-start';\nexport const startInstance = createStart(() => ({}));\n",
    ],
  ])(
    'asks for gtMiddleware when a start entry only has %s',
    async (_case, body) => {
      const start = `import { createStart } from '@tanstack/react-start';\n${body}`;
      write('src/start.ts', start);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/start.ts')).toBe(start);
      expect(result.manualActions).toEqual([
        expect.objectContaining({
          whatHappened: 'src/start.ts does not use gtMiddleware',
        }),
      ]);
    }
  );

  it.each([
    [
      'a property named gtMiddleware',
      "import { gtMiddleware } from 'gt-tanstack-start';\nconst flags = { gtMiddleware: true };\nexport const startInstance = createStart(() => ({ flags }));\n",
    ],
    [
      'a local gtMiddleware',
      'const gtMiddleware = () => {};\nexport const startInstance = createStart(() => ({ requestMiddleware: [gtMiddleware] }));\n',
    ],
  ])(
    'asks for gtMiddleware when a start entry only has %s',
    async (_case, body) => {
      const start = `import { createStart } from '@tanstack/react-start';\n${body}`;
      write('src/start.ts', start);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/start.ts')).toBe(start);
      expect(result.manualActions).toEqual([
        expect.objectContaining({
          whatHappened: 'src/start.ts does not use gtMiddleware',
        }),
      ]);
    }
  );

  it('asks for manual setup when only another component renders GTProvider', async () => {
    const root = `${templateRoot}\nexport function Preview() {\n  return <GTProvider locale="en" translations={{}} />\n}\n`;
    write('src/routes/__root.tsx', root);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(root);
    expect(result.manualActions).toEqual([
      {
        whatHappened:
          "src/routes/__root.tsx renders GTProvider outside the root route's document",
        fix: expect.stringContaining('<GTProvider locale={locale}'),
      },
    ]);
  });

  it.each([
    'initializeGT({ ...gtConfig, ...options })',
    'initializeGT(options)',
    'initializeGT({ ...gtConfig, [key]: loader })',
  ])('does not guess the storage of %s', async (call) => {
    write('src/start.ts', generatedStart);
    write(
      'src/router.tsx',
      configuredRouter.replace(
        'initializeGT({ ...gtConfig, loadTranslations })',
        call
      )
    );
    write('src/routes/__root.tsx', configuredRoot);

    const result = await tanstackStartSetup.apply(ctx());

    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('configures a root route that only mentions GTProvider in a comment', async () => {
    write(
      'src/routes/__root.tsx',
      templateRoot.replace(
        'export const Route',
        '// TODO: add GTProvider\nexport const Route'
      )
    );

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toContain(
      '<GTProvider locale={locale} translations={translations}>'
    );
    expect(result.steps).toContain('configured src/routes/__root.tsx');
  });

  it('holds start and root edits when the router imports initializeGT without calling it', async () => {
    const router = templateRouter.replace(
      "import { routeTree } from './routeTree.gen'\n",
      "import { routeTree } from './routeTree.gen'\nimport { initializeGT } from 'gt-tanstack-start'\n"
    );
    write('src/router.tsx', router);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(router);
    expect(read('src/routes/__root.tsx')).toBe(templateRoot);
    expect(fs.existsSync(file('src/start.ts'))).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.manualActions[0]).toEqual(
      expect.objectContaining({
        whatHappened: 'src/router.tsx was not configured automatically',
      })
    );
  });

  it.each([
    [
      'local files to the CDN',
      configuredRouter,
      undefined,
      'initializeGT(gtConfig)',
    ],
    [
      'the CDN to local files',
      configuredRouter
        .replace("import loadTranslations from './loadTranslations'\n", '')
        .replace(
          'initializeGT({ ...gtConfig, loadTranslations })',
          'initializeGT(gtConfig)'
        ),
      'src/_gt',
      'initializeGT({ ...gtConfig, loadTranslations })',
    ],
  ])(
    'asks to update initializeGT when storage switches from %s',
    async (_case, router, translationsDir, call) => {
      write('src/start.ts', generatedStart);
      write('src/router.tsx', router);
      write('src/routes/__root.tsx', configuredRoot);

      const result = await tanstackStartSetup.apply({
        ...ctx(),
        translationsDir,
      });

      expect(read('src/router.tsx')).toBe(router);
      expect(result.manualActions).toEqual([
        {
          whatHappened: expect.stringContaining(
            'src/router.tsx initializes GT for'
          ),
          fix: expect.stringContaining(call),
        },
      ]);
    }
  );

  it('wraps the Outlet of a component root route', async () => {
    write(
      'src/routes/__root.tsx',
      templateRoot
        .replace('shellComponent', 'component')
        .replace('{children}', '<Outlet />')
    );

    await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toContain(
      `        <GTProvider locale={locale} translations={translations}>
          <Outlet />
        </GTProvider>`
    );
  });

  it('leaves an already configured app unchanged', async () => {
    write('src/start.ts', generatedStart);
    write('src/router.tsx', configuredRouter);
    write('src/routes/__root.tsx', configuredRoot);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/start.ts')).toBe(generatedStart);
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(read('src/routes/__root.tsx')).toBe(configuredRoot);
    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('holds start and root edits when the router cannot be configured', async () => {
    // A second gtConfig import would not compile.
    const router =
      "import gtConfig from '../gt.config.json'\n\nexport function getRouter() {}\n";
    write('src/router.tsx', router);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/router.tsx')).toBe(router);
    expect(read('src/routes/__root.tsx')).toBe(templateRoot);
    expect(fs.existsSync(file('src/start.ts'))).toBe(false);
    expect(result).toEqual({
      steps: [],
      manualActions: [
        {
          whatHappened: 'src/router.tsx was not configured automatically',
          fix: expect.stringContaining(
            "import { initializeGT } from 'gt-tanstack-start'; import gtConfig from '../gt.config.json';"
          ),
        },
        {
          whatHappened:
            'src/start.ts was not created because src/router.tsx does not initialize GT',
          fix: expect.stringContaining(
            'requestMiddleware: [csrfMiddleware, gtMiddleware]'
          ),
        },
        {
          whatHappened:
            'src/routes/__root.tsx was left unchanged because src/router.tsx does not initialize GT',
          fix: expect.stringContaining('<GTProvider locale={locale}'),
        },
      ],
    });
  });

  it('leaves a root route for manual review when the edit would not parse', async () => {
    const root = `import { createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  shellComponent: RootDocument,
})

function RootDocument({ children }) { return <html><body>{children}</body></html> }
`;
    write('src/routes/__root.tsx', root);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(root);
    expect(read('src/router.tsx')).toBe(configuredRouter);
    expect(result.manualActions).toEqual([
      {
        whatHappened:
          'src/routes/__root.tsx does not match the create-start root route',
        fix: expect.stringContaining('<GTProvider locale={locale}'),
      },
    ]);
  });

  it('keeps the indent unit after a leading JSDoc', async () => {
    write('src/routes/__root.tsx', `/**\n * Root route.\n */\n${templateRoot}`);

    await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(
      `/**\n * Root route.\n */\n${configuredRoot}`
    );
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

  it('preserves a custom loader and imports its named export', async () => {
    const loader =
      'export async function loadTranslations(locale: string) { return {}; }\n';
    write('src/loadTranslations.ts', loader);

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/loadTranslations.ts')).toBe(loader);
    expect(read('src/router.tsx')).toContain(
      "import { loadTranslations } from './loadTranslations'\n"
    );
    expect(result.manualActions).toEqual([
      {
        whatHappened: 'Your custom src/loadTranslations.ts was preserved',
        fix: 'Verify src/loadTranslations.ts loads translations from src/_gt',
      },
    ]);
  });

  it.each(['src/router.tsx', 'src/routes/__root.tsx'])(
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
