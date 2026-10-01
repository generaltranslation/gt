import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import { traverseFast } from '@babel/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tanstackStartSetup } from '../buildTools/tanstackStart/index.js';

const parserOptions = {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
} as const;

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

// A Fumadocs root route, whose component renders a local document.
const documentRoot = `import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { RootProvider } from "fumadocs-ui/provider/tanstack"

export const Route = createRootRoute({
	head: () => ({
		meta: [{ charSet: "utf-8" }],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="flex flex-col min-h-screen">
				<RootProvider>{children}</RootProvider>
				<Scripts />
			</body>
		</html>
	)
}
`;

const configuredDocumentRoot = `import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { RootProvider } from "fumadocs-ui/provider/tanstack"
import { GTProvider, getLocale, getTranslationsSnapshot } from "gt-tanstack-start"

export const Route = createRootRoute({
	head: () => ({
		meta: [{ charSet: "utf-8" }],
	}),
	loader: async () => {
		const locale = getLocale()
		return { locale, translations: await getTranslationsSnapshot(locale) }
	},
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { locale, translations } = Route.useLoaderData()
	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="flex flex-col min-h-screen">
				<GTProvider locale={locale} translations={translations}>
					<RootProvider>{children}</RootProvider>
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
        'created src/loadTranslations.ts',
        'created src/start.ts',
        'configured src/router.tsx',
        'configured src/routes/__root.tsx',
      ],
      manualActions: [],
    });
  });

  it('reports a loader it rewrites for a new translations directory', async () => {
    await tanstackStartSetup.apply(ctx());

    const result = await tanstackStartSetup.apply({
      ...ctx(),
      translationsDir: 'public/_gt',
      previousTranslationsDir: 'src/_gt',
    });

    expect(read('src/loadTranslations.ts')).toContain('../public/_gt/');
    expect(result).toEqual({
      steps: ['updated src/loadTranslations.ts'],
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
    // The root loader needs the request scope gtMiddleware sets up; without
    // it every page fails to render.
    expect(read('src/routes/__root.tsx')).toBe(templateRoot);
    expect(result.manualActions).toEqual([
      {
        whatHappened: 'src/start.ts does not use gtMiddleware',
        fix: expect.stringMatching(
          /keeping your existing middleware.*, then rerun gt init/
        ),
      },
    ]);

    write('src/start.ts', generatedStart);
    const rerun = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(configuredRoot);
    expect(rerun).toEqual({
      steps: ['configured src/routes/__root.tsx'],
      manualActions: [],
    });
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
    [
      'a validateSearch',
      templateRoot.replace(
        '  shellComponent: RootDocument,',
        '  validateSearch: () => ({}),\n  shellComponent: RootDocument,'
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
    [
      'a property named gtMiddleware',
      "import { gtMiddleware } from 'gt-tanstack-start';\nconst flags = { gtMiddleware: true };\nexport const startInstance = createStart(() => ({ flags }));\n",
    ],
    [
      'a local gtMiddleware',
      'const gtMiddleware = () => {};\nexport const startInstance = createStart(() => ({ requestMiddleware: [gtMiddleware] }));\n',
    ],
    [
      'gtMiddleware in functionMiddleware',
      "import { gtMiddleware } from 'gt-tanstack-start';\nexport const startInstance = createStart(() => ({ functionMiddleware: [gtMiddleware] }));\n",
    ],
  ])(
    'asks for gtMiddleware when a start entry only has %s',
    async (_case, body) => {
      const start = `import { createStart } from '@tanstack/react-start';\n${body}`;
      write('src/start.ts', start);

      const result = await tanstackStartSetup.apply(ctx());

      expect(read('src/start.ts')).toBe(start);
      expect(result.manualActions[0]).toEqual(
        expect.objectContaining({
          whatHappened: 'src/start.ts does not use gtMiddleware',
        })
      );
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
    await tanstackStartSetup.apply(ctx());
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
    expect(result.steps).toEqual(['created src/loadTranslations.ts']);
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
      "initializeGT({ ...gtConfig, loadTranslations }) and add import loadTranslations from './loadTranslations'",
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

  it('wraps everything the body renders before Scripts', async () => {
    write(
      'src/routes/__root.tsx',
      templateRoot.replace(
        `        {children}

        <Scripts />`,
        `        <Header />
        {children}
        <Footer />
        <TanStackDevtools
          plugins={[]}
        />
        <Scripts />`
      )
    );

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toContain(`      <body>
        <GTProvider locale={locale} translations={translations}>
          <Header />
          {children}
          <Footer />
          <TanStackDevtools
            plugins={[]}
          />
        </GTProvider>
        <Scripts />
      </body>`);
    expect(result.manualActions).toEqual([]);
  });

  it.each([
    [
      'a line-continued string',
      "<Header label={'Hello\\\n          world'} />",
    ],
    [
      'a multi-line attribute string',
      '<Header title="Hello\n          world" />',
    ],
  ])('keeps the value of %s when wrapping the body', async (_case, header) => {
    const literalValues = (source: string) => {
      const values: string[] = [];
      traverseFast(parse(source, parserOptions), (node) => {
        if (node.type === 'StringLiteral') values.push(node.value);
      });
      return values.filter((value) => value.startsWith('Hello'));
    };
    const root = templateRoot.replace(
      '        {children}\n',
      `        ${header}\n        {children}\n`
    );
    write('src/routes/__root.tsx', root);

    const result = await tanstackStartSetup.apply(ctx());

    const configured = read('src/routes/__root.tsx');
    expect(result.steps).toContain('configured src/routes/__root.tsx');
    expect(literalValues(configured)).toEqual(literalValues(root));
  });

  it('wraps a provider that renders the children', async () => {
    write(
      'src/routes/__root.tsx',
      templateRoot.replace(
        '        {children}\n',
        '        <ClerkProvider>\n          {children}\n        </ClerkProvider>\n'
      )
    );

    await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toContain(`      <body>
        <GTProvider locale={locale} translations={translations}>
          <ClerkProvider>
            {children}
          </ClerkProvider>
        </GTProvider>

        <Scripts />`);
  });

  it('configures a root route created with context', async () => {
    const withContext = (root: string) =>
      root
        .replace('createRootRoute } from', 'createRootRouteWithContext } from')
        .replace(
          'export const Route = createRootRoute({',
          'interface MyRouterContext {\n  queryClient: unknown\n}\n\nexport const Route = createRootRouteWithContext<MyRouterContext>()({'
        );
    write('src/routes/__root.tsx', withContext(templateRoot));

    const result = await tanstackStartSetup.apply(ctx());
    const rerun = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(withContext(configuredRoot));
    expect(result.manualActions).toEqual([]);
    expect(rerun).toEqual({ steps: [], manualActions: [] });
  });

  it('configures the document a root route component renders', async () => {
    write('src/routes/__root.tsx', documentRoot);

    const result = await tanstackStartSetup.apply(ctx());
    const rerun = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(configuredDocumentRoot);
    expect(result.manualActions).toEqual([]);
    expect(rerun).toEqual({ steps: [], manualActions: [] });
  });

  it('configures the document a shell component renders', async () => {
    const shell = (root: string) =>
      root
        .replace('component: RootComponent', 'shellComponent: RootComponent')
        .replace(
          'function RootComponent() {',
          'function RootComponent({ children }: { children: React.ReactNode }) {'
        )
        .replace('<Outlet />', '{children}');
    write('src/routes/__root.tsx', shell(documentRoot));

    const result = await tanstackStartSetup.apply(ctx());

    expect(read('src/routes/__root.tsx')).toBe(shell(configuredDocumentRoot));
    expect(result.manualActions).toEqual([]);
  });

  it.each([
    [
      'a document given other children',
      documentRoot.replace('\t\t\t<Outlet />', '\t\t\t<Main />'),
    ],
    [
      'a component that names locale',
      documentRoot.replace('<RootDocument>', '<RootDocument locale="en">'),
    ],
    [
      'a document that names translations',
      documentRoot.replace(
        '<RootProvider>',
        '<RootProvider translations={{}}>'
      ),
    ],
    [
      'a component that renders more than the document',
      documentRoot.replace(
        '\treturn (\n\t\t<RootDocument>',
        '\tuseTheme()\n\treturn (\n\t\t<RootDocument>'
      ),
    ],
    [
      'an imported document',
      documentRoot.replace('function RootDocument', 'function Other'),
    ],
    [
      'a document the error component also renders',
      documentRoot.replace(
        '\tcomponent: RootComponent,',
        '\tvalidateSearch: () => {\n\t\tthrow new Error("Invalid search")\n\t},\n\terrorComponent: () => <RootDocument>Invalid search</RootDocument>,\n\tcomponent: RootComponent,'
      ),
    ],
    [
      'a shell document and a validateSearch',
      documentRoot
        .replace(
          '\tcomponent: RootComponent,',
          '\tvalidateSearch: () => ({}),\n\tshellComponent: RootComponent,'
        )
        .replace('<Outlet />', '{children}')
        .replace(
          'function RootComponent()',
          'function RootComponent({ children }: { children: React.ReactNode })'
        ),
    ],
    [
      'a shell document and a computed validateSearch key',
      documentRoot
        .replace(
          '\tcomponent: RootComponent,',
          "\t['validateSearch']: () => {\n\t\tthrow new Error('Invalid search')\n\t},\n\tshellComponent: RootComponent,"
        )
        .replace('<Outlet />', '{children}')
        .replace(
          'function RootComponent()',
          'function RootComponent({ children }: { children: React.ReactNode })'
        ),
    ],
    [
      'a document used as another component',
      documentRoot.replace(
        '\tcomponent: RootComponent,',
        '\tnotFoundComponent: RootDocument,\n\tcomponent: RootComponent,'
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
      steps: ['created src/loadTranslations.ts'],
      manualActions: [
        {
          whatHappened: 'src/router.tsx was not configured automatically',
          fix: expect.stringMatching(
            /import { initializeGT } from 'gt-tanstack-start'; import gtConfig from '\.\.\/gt\.config\.json';.*, then rerun gt init/
          ),
        },
      ],
    });

    write('src/router.tsx', configuredRouter);
    const rerun = await tanstackStartSetup.apply(ctx());

    expect(read('src/start.ts')).toBe(generatedStart);
    expect(read('src/routes/__root.tsx')).toBe(configuredRoot);
    expect(rerun).toEqual({
      steps: ['created src/start.ts', 'configured src/routes/__root.tsx'],
      manualActions: [],
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

  it('asks configure to pass the loader when a CDN router switches to local files', async () => {
    const router = configuredRouter
      .replace("import loadTranslations from './loadTranslations'\n", '')
      .replace(
        'initializeGT({ ...gtConfig, loadTranslations })',
        'initializeGT(gtConfig)'
      );
    write('src/router.tsx', router);

    const result = await tanstackStartSetup.syncLoader({
      ...ctx(),
      translationsDir: 'src/_gt',
    });

    expect(read('src/router.tsx')).toBe(router);
    expect(read('src/loadTranslations.ts')).toContain('./_gt/');
    expect(result).toEqual({
      steps: ['created src/loadTranslations.ts'],
      manualActions: [
        {
          whatHappened:
            'src/router.tsx initializes GT for CDN translations, but translations are now stored in src/_gt',
          fix: expect.stringContaining(
            "initializeGT({ ...gtConfig, loadTranslations }) and add import loadTranslations from './loadTranslations'"
          ),
        },
      ],
    });
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
