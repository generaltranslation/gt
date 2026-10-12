import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reactRouterSetup } from '../buildTools/reactRouter/index.js';
import { configureRoot, getRootFix } from '../buildTools/reactRouter/root.js';
import { DOCS_URL } from '../buildTools/reactRouter/source.js';
import { parseModule, type ViteLoaderExport } from '../setupViteSPA.js';
import {
  CONFIGURED_CREATE_REACT_ROUTER_ROOT,
  CONFIGURED_HYDROGEN_ROOT,
  CREATE_REACT_ROUTER_ROOT as ROOT,
  HYDROGEN_ROOT,
} from './reactRouterRoots.js';

const CONFIG = 'react-router.config.ts';
const UNREADABLE = 'setup cannot read the options react-router.config exports';
/** The CDN initializeGT call, quoted the way the root module quotes strings. */
const cdnCall = (quote: string) =>
  `initializeGT({ ...gtConfig, projectId: (${quote}projectId${quote} in gtConfig && typeof gtConfig.projectId === ${quote}string${quote} && gtConfig.projectId) || import.meta.env.VITE_GT_PROJECT_ID })`;
const CDN_CALL = cdnCall('"');
const LOCAL_STORAGE_CALL =
  "initializeGT({ ...gtConfig, loadTranslations }) and add import loadTranslations from './loadTranslations'";
const MISSING_EXPORT =
  'Your custom app/loadTranslations.ts has no runtime loadTranslations export';
const UNCONFIGURED =
  'app/root.tsx does not match the create-react-router or Hydrogen starter';

function configure(
  content: string,
  {
    path: filePath = 'app/root.tsx',
    loaderExport = 'default',
  }: { path?: string; loaderExport?: ViteLoaderExport } = {}
) {
  return configureRoot(
    { path: filePath, content, statements: parseModule(content, filePath) },
    { configImport: '../gt.config.json', loaderExport }
  );
}

/** The starter root module, with `code` declared before Layout. */
function rootWith(code: string): string {
  return ROOT.replace(
    'export function Layout',
    `${code}\nexport function Layout`
  );
}

const ARGS = '{ request }: Route.LoaderArgs';
const RETURN = 'return { user: 1 };';

/** The starter root module with a root loader whose body is `body`. */
function rootWithLoader(body: string, signature = ARGS) {
  return rootWith(
    `export async function loader(${signature}) {\n  ${body}\n}\n`
  );
}

/** The starter root module, with `statement` first in Layout. */
function layoutWith(statement: string, root = ROOT): string {
  return root.replace(
    '  return (\n    <html',
    `  ${statement}\n  return (\n    <html`
  );
}

/** Binds `name` only inside a helper, which the configured module still parses with. */
function shadowing(name: string): string {
  return rootWith(
    `function helper() {\n  const ${name} = 1;\n  return ${name};\n}\n`
  );
}

/** The starter root module, importing the hook under `name`. */
const importingHookAs = (name: string) =>
  ROOT.replace(
    'isRouteErrorResponse,',
    `useRouteLoaderData${name === 'useRouteLoaderData' ? '' : ` as ${name}`},\n  isRouteErrorResponse,`
  );
const HOOK_ROOT = importingHookAs('useRouteLoaderData');

/** Hydrogen 2025's Layout reads the root data and renders children in a ternary. */
const HYDROGEN_2025_ROOT = HYDROGEN_ROOT.replace(
  '  const nonce = useNonce();\n',
  "  const nonce = useNonce();\n  const data = useRouteLoaderData<RootLoader>('root');\n"
).replace(
  '        {children}\n',
  `        {data ? (
          <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
            <PageLayout {...data}>{children}</PageLayout>
          </Analytics.Provider>
        ) : (
          children
        )}
`
);

const JSX_ROOT = `import { Scripts } from 'react-router'

export function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`;

describe('configureRoot', () => {
  it.each([
    // Strict TypeScript rejects an untyped destructured parameter.
    [
      'a typed root without the Route import',
      configure(
        ROOT.replace('import type { Route } from "./+types/root";\n', '')
      ),
      'export async function loader({ request }: { request: Request }) {',
    ],
    [
      'an aliased Route import',
      configure(
        ROOT.replace(
          'import type { Route }',
          'import type { Route as RootRoute }'
        )
      ),
      'export async function loader({ request }: RootRoute.LoaderArgs) {',
    ],
    [
      'a JSDoc comment on Layout',
      configure(rootWith('/** The document. */')),
      '}\n\n/** The document. */\nexport function Layout',
    ],
    [
      'a comment ending the line before Layout',
      configure(
        ROOT.replace(
          '];\n\nexport function Layout',
          '];  // links\n\nexport function Layout'
        )
      ),
      '];  // links\n\nexport async function loader(',
    ],
    [
      'a `{ request }` loader',
      configure(rootWithLoader(RETURN)),
      'const locale = parseLocale(request);\n  return { locale, translations: await getTranslationsSnapshot(locale), user: 1 };',
    ],
    [
      'a `{ context, request }` loader',
      configure(
        rootWithLoader(RETURN, '{ context, request }: Route.LoaderArgs')
      ),
      'const locale = parseLocale(request);',
    ],
    [
      'a `{ request: req }` loader',
      configure(rootWithLoader(RETURN, '{ request: req }: Route.LoaderArgs')),
      'const locale = parseLocale(req);',
    ],
    [
      'a named loadTranslations export',
      configure(ROOT, { loaderExport: 'loadTranslations' }),
      'import { loadTranslations } from "./loadTranslations";',
    ],
    // A type-only import is erased, so the hook joins the value import.
    [
      'a type-only react-router import',
      configure(
        ROOT.replace(
          'import {\n  isRouteErrorResponse,',
          'import type { MetaFunction } from "react-router";\nimport {\n  isRouteErrorResponse,'
        )
      ),
      '  ScrollRestoration,\n  useRouteLoaderData,\n} from "react-router";',
    ],
    [
      "Hydrogen 2025's Layout",
      configure(HYDROGEN_2025_ROOT),
      "  const locale = useRouteLoaderData<typeof loader>('root')?.locale ?? gtConfig.defaultLocale;\n  const nonce = useNonce();",
      '        <RootGTProvider>\n          {data ? (',
    ],
    [
      'a .jsx root',
      configure(JSX_ROOT, { path: 'app/root.jsx' }),
      "import { Scripts, useRouteLoaderData } from 'react-router'\n",
      'export async function loader({ request }) {',
      'function RootGTProvider({ children }) {',
      "const locale = useRouteLoaderData('root')?.locale ?? gtConfig.defaultLocale",
    ],
  ])('configures %s', (_, configured, ...lines) => {
    for (const line of lines) expect(configured).toContain(line);
  });

  it.each([
    // Each binds a name setup adds, in a scope the configured module still parses with.
    ...[
      'GTProvider',
      'initializeGT',
      'gtConfig',
      'getTranslationsSnapshot',
      'parseLocale',
      'loadTranslations',
      'RootGTProvider',
      'useRouteLoaderData',
    ].map((name) => [`binds ${name}`, shadowing(name)]),
    ['imports the hook under another name', importingHookAs('useRootData')],
    // React Router hydrates with a clientLoader's data instead of the loader's.
    [
      'has a clientLoader',
      rootWith('export async function clientLoader() {\n  return {};\n}\n'),
    ],
    ['re-exports its loader', rootWith('export { loader } from "./loader";\n')],
    [
      'has an arrow loader',
      rootWith(`export const loader = async (${ARGS}) => {\n  ${RETURN}\n};\n`),
    ],
    [
      'has a non-async loader',
      rootWith(`export function loader(${ARGS}) {\n  ${RETURN}\n}\n`),
    ],
    [
      'types the loader return',
      rootWith(
        `export async function loader(${ARGS}): Promise<{ user: number }> {\n  ${RETURN}\n}\n`
      ),
    ],
    // React Router only calls an exported loader.
    [
      'has a non-exported loader',
      rootWith(`async function loader(${ARGS}) {\n  ${RETURN}\n}\n`),
    ],
    [
      'has a loader without request',
      rootWithLoader(RETURN, '{ context }: Route.LoaderArgs'),
    ],
    [
      'destructures request',
      rootWithLoader(RETURN, '{ request: { url } }: Route.LoaderArgs'),
    ],
    [
      'returns in a nested function',
      rootWithLoader(
        'const read = () => {\n    return 1;\n  };\n  return { user: read() };'
      ),
    ],
    [
      'returns a callback with its own return',
      rootWithLoader('return { user: [1].map((x) => {\n    return x;\n  }) };'),
    ],
    [
      'returns inside an if',
      rootWithLoader('if (request.url) {\n    return { user: 1 };\n  }'),
    ],
    [
      'returns after code on the same line',
      rootWithLoader('const user = 1; return { user };'),
    ],
    ['returns a call', rootWithLoader('return json({ user: 1 });')],
    ['returns an empty object', rootWithLoader('return {};')],
    ['returns a computed key', rootWithLoader('return { [key]: 1 };')],
    [
      "returns a quoted 'translations' key",
      rootWithLoader("return { 'translations': 1 };"),
    ],
    [
      'has a loader mentioning locale',
      rootWithLoader('return { user: request.headers.get("locale") };'),
    ],
    ['references locale in Layout', layoutWith('console.log(locale);')],
    // With an exported loader, so only the Layout check rejects it.
    [
      'declares loader in Layout',
      layoutWith('const loader = null;', rootWithLoader(RETURN)),
    ],
    [
      'rebinds the hook in Layout',
      layoutWith('const useRouteLoaderData = () => null;', HOOK_ROOT),
    ],
    [
      'passes the hook in Layout',
      layoutWith('wrap(useRouteLoaderData);', HOOK_ROOT),
    ],
    [
      'optionally calls the hook in Layout',
      layoutWith("useRouteLoaderData?.('root');", HOOK_ROOT),
    ],
    [
      'has a concise arrow Layout',
      "import { Scripts } from 'react-router';\nexport const Layout = ({ children }) => (\n  <html>\n    <body>\n      {children}\n      <Scripts />\n    </body>\n  </html>\n);\n",
    ],
    [
      'exports no Layout',
      ROOT.replace('export function Layout', 'function Layout'),
    ],
    ['renders no <Scripts />', ROOT.replace('        <Scripts />\n', '')],
    // The hook joins the module's own react-router import.
    [
      'imports React Router from another package',
      ROOT.replace('} from "react-router";', '} from "react-router-dom";'),
    ],
    [
      'spreads attributes onto html',
      ROOT.replace('<html lang="en">', '<html {...props}>'),
    ],
    [
      'renders two html elements',
      layoutWith('if (!children) return <html><body /></html>;'),
    ],
    ['renders no children slot', ROOT.replace('{children}', '<Outlet />')],
    // Without semicolons, Layout's new first line would join this statement.
    [
      'starts Layout with an array in a module without semicolons',
      JSX_ROOT.replace('  return (', '  [1].forEach(console.log)\n  return ('),
    ],
    ['cannot be parsed', 'export function Layout( {'],
  ])('leaves a module that %s for manual setup', (_, root) => {
    expect(configure(root)).toBeUndefined();
  });
});

describe('getRootFix', () => {
  it('names the root module and the docs', () => {
    const fix = getRootFix('app/root.jsx', {
      configImport: '../gt.config.json',
      loaderExport: 'default',
    });
    expect(fix).toContain('app/root.jsx');
    expect(fix).toContain(DOCS_URL);
    expect(fix).toContain("loadTranslations from './loadTranslations'");
    expect(fix).toContain('await getTranslationsSnapshot(locale)');
  });

  it('imports a named loader export', () => {
    expect(
      getRootFix('app/root.tsx', {
        configImport: '../gt.config.json',
        loaderExport: 'loadTranslations',
      })
    ).toContain(
      "gtConfig from '../gt.config.json' and { loadTranslations } from './loadTranslations', then call initializeGT({ ...gtConfig, loadTranslations })"
    );
  });
});

describe('reactRouterSetup', () => {
  let appDirectory: string;
  const file = (name: string) => path.join(appDirectory, name);
  const read = (name: string) => fs.readFileSync(file(name), 'utf8');
  const write = (name: string, content: string) => {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), content);
  };
  const writeAll = (files: Record<string, string>) => {
    for (const [name, content] of Object.entries(files)) write(name, content);
  };
  // Local storage unless a test passes undefined for CDN translations.
  const ctx = <T extends string | undefined>(translationsDir: T) => ({
    appDirectory,
    configFilepath: 'gt.config.json',
    defaultLocale: 'en',
    locales: ['fr', 'ja'],
    translationsDir,
  });
  /** Every file under the app, to prove a run wrote nothing. */
  const snapshot = () =>
    Object.fromEntries(
      (fs.readdirSync(appDirectory, { recursive: true }) as string[])
        .filter((name) => fs.statSync(file(name)).isFile())
        .sort()
        .map((name) => [name, read(name)])
    );
  const storageAction = (fix: string) =>
    expect.objectContaining({ fix: expect.stringContaining(fix) });
  /** The configured root, with GTProvider rendered by a wrapper in another file. */
  const splitProvider = () =>
    write(
      'app/root.tsx',
      read('app/root.tsx')
        .replace(
          'import gtConfig',
          'import { AppProvider } from "./AppProvider";\nimport gtConfig'
        )
        .replace(/<(\/?)GTProvider/g, '<$1AppProvider')
    );

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-react-router-'));
    write('gt.config.json', '{}');
    write('app/root.tsx', ROOT);
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  describe('preflight', () => {
    const SPA = 'ssr: false';
    const PRERENDER = 'pre-renders pages';
    const APP_DIRECTORY = 'appDirectory other than app';
    const NOT_FRAMEWORK = 'neither @react-router/dev nor a react-router.config';
    const OUTDATED = 'gt-react versions older than 11.1.3';
    const packageJson = (dependencies: Record<string, string>) => ({
      'package.json': JSON.stringify({ dependencies }),
    });
    /** A string is the content of react-router.config.ts. */
    const writeConfig = (files: string | Record<string, string>) =>
      writeAll(typeof files === 'string' ? { [CONFIG]: files } : files);

    it.each<string | Record<string, string>>([
      'export default {} satisfies Config;',
      'export default { presets: [hydrogenPreset()] } satisfies Config;',
      'export default { ssr: true, prerender: false, appDirectory: "app" };',
      'export default { "ssr": true } as const;',
      'export default { ssr: true as const, appDirectory: "app" as const };',
      'const config = { ssr: true } satisfies Config;\nexport default config;',
      'export default { async buildEnd() {} };',
      // Values React Router treats like its defaults.
      'export default { prerender: [], appDirectory: "./app" };',
      packageJson({ '@react-router/dev': '^7.0.0' }),
      packageJson({ '@react-router/dev': '^7.0.0', 'gt-react': '^11.1.3' }),
      // A monorepo may install @react-router/dev at its root.
      { 'package.json': '{}', [CONFIG]: 'export default {};' },
    ])('accepts %s', async (files) => {
      writeConfig(files);
      await expect(
        reactRouterSetup.preflight(appDirectory)
      ).resolves.toBeUndefined();
    });

    it.each([
      ['export default { ssr: false };', SPA],
      ...['.js', '.jsx', '.tsx', '.mjs', '.mts'].map((extension) => [
        {
          [`react-router.config${extension}`]: 'export default { ssr: false };',
        },
        SPA,
      ]),
      ['export default { ssr: true, ssr: false };', SPA],
      ['const c = { ssr: false } satisfies Config;\nexport default c;', SPA],
      ['export default { ssr: process.env.SSR === "1" };', UNREADABLE],
      [
        'const c = { ssr: true };\nc.ssr = false;\nexport default c;',
        UNREADABLE,
      ],
      ['let c = { ssr: true };\nexport default c;', UNREADABLE],
      ['const c = { ssr: true };\nexport { c as default };', UNREADABLE],
      ['export default <Config>{ ssr: true };', UNREADABLE],
      ['export default createConfig();', UNREADABLE],
      ['export default { ...shared };', UNREADABLE],
      ['export default { ["ssr"]: true };', UNREADABLE],
      ['export default {', UNREADABLE],
      ['export default { prerender: true };', PRERENDER],
      ['export default { ssr: false, prerender: [] };', SPA],
      ['export default { prerender: ["/"] };', PRERENDER],
      ['export default { async prerender() { return []; } };', PRERENDER],
      ['export default { appDirectory: "../app" };', APP_DIRECTORY],
      ['export default { appDirectory: "src" };', APP_DIRECTORY],
      // A Vite app using React Router as a library, and a Remix app.
      [packageJson({ 'react-router': '^7.0.0' }), NOT_FRAMEWORK],
      [packageJson({ '@remix-run/dev': '^2.0.0' }), NOT_FRAMEWORK],
      // parseLocale is new in 11.0.4; Oxygen's worker build needs 11.1.3.
      [
        packageJson({ '@react-router/dev': '^7.0.0', 'gt-react': '^11.0.3' }),
        OUTDATED,
      ],
      [
        packageJson({ '@react-router/dev': '^7.0.0', 'gt-react': '11.1.1' }),
        OUTDATED,
      ],
      [
        packageJson({
          '@react-router/dev': '^7.0.0',
          '@vitejs/plugin-rsc': '^0.5.0',
        }),
        'RSC Framework Mode',
      ],
    ])('refuses %s before writing', async (files, message) => {
      writeConfig(files);
      const before = snapshot();
      await expect(reactRouterSetup.preflight(appDirectory)).rejects.toThrow(
        message
      );
      expect(snapshot()).toEqual(before);
    });

    it('refuses an app without a root module', async () => {
      fs.rmSync(file('app/root.tsx'));
      await expect(reactRouterSetup.preflight(appDirectory)).rejects.toThrow(
        'app/root.tsx was not found'
      );
    });
  });

  describe('apply', () => {
    it.each([
      ['create-react-router', ROOT, CONFIGURED_CREATE_REACT_ROUTER_ROOT],
      ['Hydrogen', HYDROGEN_ROOT, CONFIGURED_HYDROGEN_ROOT],
    ])('configures a %s app', async (_, root, configured) => {
      write('app/root.tsx', root);

      const result = await reactRouterSetup.apply(ctx('app/_gt'));

      expect(read('app/root.tsx')).toBe(configured);
      expect(read('app/loadTranslations.ts')).toContain('./_gt/${locale}.json');
      expect(result).toEqual({
        steps: ['created app/loadTranslations.ts', 'configured app/root.tsx'],
        manualActions: [],
      });
    });

    it('reports nothing on a rerun', async () => {
      await reactRouterSetup.apply(ctx('app/_gt'));
      const files = snapshot();

      expect(await reactRouterSetup.apply(ctx('app/_gt'))).toEqual({
        steps: [],
        manualActions: [],
      });
      expect(snapshot()).toEqual(files);
    });

    it('initializes from the CDN without writing a loader', async () => {
      const result = await reactRouterSetup.apply(ctx(undefined));

      expect(read('app/root.tsx')).toContain(`${CDN_CALL};`);
      expect(read('app/root.tsx')).not.toContain('./loadTranslations');
      expect(fs.existsSync(file('app/loadTranslations.ts'))).toBe(false);
      expect(result).toEqual({
        steps: ['configured app/root.tsx'],
        manualActions: [],
      });
    });

    it.each([
      [
        'CDN to local',
        undefined,
        'app/_gt',
        ['created app/loadTranslations.ts'],
        'initializes GT for CDN translations',
        LOCAL_STORAGE_CALL,
      ],
      [
        'local to CDN',
        'app/_gt',
        undefined,
        [],
        'initializes GT for local translation files',
        `${cdnCall("'")} and remove the loadTranslations import`,
      ],
    ])(
      'reports a rerun that switched %s',
      async (_, first, second, steps, whatHappened, fix) => {
        await reactRouterSetup.apply(ctx(first));
        const root = read('app/root.tsx');

        const result = await reactRouterSetup.apply(ctx(second));

        expect(read('app/root.tsx')).toBe(root);
        expect(result).toEqual({
          steps,
          manualActions: [
            {
              whatHappened: expect.stringContaining(whatHappened),
              fix: expect.stringContaining(fix),
            },
          ],
        });
      }
    );

    it.each([
      ['apply', reactRouterSetup.apply],
      ['syncLoader', reactRouterSetup.syncLoader],
    ])(
      'quotes a named loader export when %s moves a CDN root to local files',
      async (_, run) => {
        await reactRouterSetup.apply(ctx(undefined));
        write(
          'app/loadTranslations.ts',
          'export async function loadTranslations() {\n  return {};\n}\n'
        );

        const { manualActions } = await run(ctx('app/_gt'));

        expect(manualActions).toContainEqual({
          whatHappened: expect.stringContaining(
            'initializes GT for CDN translations'
          ),
          fix: expect.stringContaining(
            "initializeGT({ ...gtConfig, loadTranslations }) and add import { loadTranslations } from './loadTranslations'"
          ),
        });
      }
    );

    it.each([
      'initializeGT(options)',
      'initializeGT({ ...gtConfig, ...options })',
    ])('does not guess the storage of %s', async (call) => {
      await reactRouterSetup.apply(ctx(undefined));
      write('app/root.tsx', read('app/root.tsx').replace(CDN_CALL, call));

      expect(await reactRouterSetup.apply(ctx('app/_gt'))).toEqual({
        steps: ['created app/loadTranslations.ts'],
        manualActions: [],
      });
    });

    // Only the initializeGT call needs the loader, so a GTProvider rendered in
    // another file must not hide the storage change.
    it('reports the storage change for a root whose GTProvider renders elsewhere', async () => {
      await reactRouterSetup.apply(ctx(undefined));
      splitProvider();
      const root = read('app/root.tsx');

      const result = await reactRouterSetup.apply(ctx('app/_gt'));

      expect(read('app/root.tsx')).toBe(root);
      expect(result.manualActions).toEqual([storageAction(LOCAL_STORAGE_CALL)]);
    });

    it.each([
      [
        'renders only GTProvider',
        ROOT.replace(
          'import type { Route }',
          'import { GTProvider } from "gt-react";\nimport type { Route }'
        ).replace('{children}', '<GTProvider>{children}</GTProvider>'),
      ],
      [
        'computes lang',
        ROOT.replace('<html lang="en">', '<html lang={getLang()}>'),
      ],
    ])(
      'leaves a root that %s unchanged with the manual steps',
      async (_, root) => {
        write('app/root.tsx', root);

        const result = await reactRouterSetup.apply(ctx('app/_gt'));

        expect(read('app/root.tsx')).toBe(root);
        expect(result).toEqual({
          steps: ['created app/loadTranslations.ts'],
          manualActions: [
            {
              whatHappened: UNCONFIGURED,
              fix: getRootFix('app/root.tsx', {
                configImport: '../gt.config.json',
                loaderExport: 'default',
              }),
            },
          ],
        });
      }
    );

    it('leaves the root alone when a custom loader has no export', async () => {
      write('app/loadTranslations.ts', 'const translations = {};\n');

      const result = await reactRouterSetup.apply(ctx('app/_gt'));

      expect(read('app/root.tsx')).toBe(ROOT);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          expect.objectContaining({ whatHappened: MISSING_EXPORT }),
        ],
      });
    });

    // The root imports the preserved loader, which may read somewhere else.
    it('asks to verify a custom loader it preserved', async () => {
      const custom =
        'export default async (locale) => (await import(`./locales/${locale}.json`)).default;\n';
      write('app/loadTranslations.ts', custom);

      const result = await reactRouterSetup.apply(ctx('app/_gt'));

      expect(read('app/loadTranslations.ts')).toBe(custom);
      expect(read('app/root.tsx')).toBe(CONFIGURED_CREATE_REACT_ROUTER_ROOT);
      expect(result).toEqual({
        steps: ['configured app/root.tsx'],
        manualActions: [
          {
            whatHappened: 'Your custom app/loadTranslations.ts was preserved',
            fix: 'Verify app/loadTranslations.ts loads translations from app/_gt',
          },
        ],
      });
    });

    it('imports a config file at a custom path', async () => {
      write('config/gt.json', '{}');

      await reactRouterSetup.apply({
        ...ctx('app/_gt'),
        configFilepath: 'config/gt.json',
      });

      expect(read('app/root.tsx')).toContain(
        'import gtConfig from "../config/gt.json";'
      );
    });

    it('updates a generated loader when the translations directory changes', async () => {
      await reactRouterSetup.apply(ctx('app/_gt'));

      const result = await reactRouterSetup.apply({
        ...ctx('app/locales'),
        previousTranslationsDir: 'app/_gt',
      });

      expect(read('app/loadTranslations.ts')).toContain(
        './locales/${locale}.json'
      );
      expect(result).toEqual({
        steps: ['updated app/loadTranslations.ts'],
        manualActions: [],
      });
    });
  });

  describe('getCDNStorageAction', () => {
    // undefined keeps configure's generic step; null means nothing to change.
    it.each([
      ['a root it has not configured', async () => {}, undefined],
      [
        'a root that loads from the CDN',
        () => reactRouterSetup.apply(ctx(undefined)),
        null,
      ],
    ])('returns %s', async (_, setUp, expected) => {
      await setUp();

      expect(await reactRouterSetup.getCDNStorageAction!(ctx(undefined))).toBe(
        expected
      );
    });
  });

  describe('syncLoader', () => {
    const moved = () => ({
      ...ctx('app/locales'),
      previousTranslationsDir: 'app/_gt',
    });

    it('points a generated loader at a new translations directory', async () => {
      await reactRouterSetup.apply(ctx('app/_gt'));

      const result = await reactRouterSetup.syncLoader(moved());

      expect(read('app/loadTranslations.ts')).toContain(
        './locales/${locale}.json'
      );
      expect(result).toEqual({
        steps: ['updated app/loadTranslations.ts'],
        manualActions: [],
      });
    });

    it('reports a custom loader instead of overwriting it', async () => {
      const custom = 'export default async () => ({});\n';
      write('app/loadTranslations.ts', custom);

      const result = await reactRouterSetup.syncLoader(moved());

      expect(read('app/loadTranslations.ts')).toBe(custom);
      expect(result.manualActions).toEqual([
        expect.objectContaining({
          fix: 'Update your custom app/loadTranslations.ts to load translations from app/locales',
        }),
      ]);
    });

    it.each([
      ['a CDN root', () => {}],
      ['a CDN root whose GTProvider renders elsewhere', splitProvider],
    ])(
      'creates the loader for %s switching to local storage',
      async (_, edit) => {
        await reactRouterSetup.apply(ctx(undefined));
        edit();

        const result = await reactRouterSetup.syncLoader(ctx('app/_gt'));

        expect(read('app/loadTranslations.ts')).toContain(
          './_gt/${locale}.json'
        );
        expect(result).toEqual({
          steps: ['created app/loadTranslations.ts'],
          manualActions: [storageAction(LOCAL_STORAGE_CALL)],
        });
      }
    );

    it('creates nothing for a root it has not configured', async () => {
      const files = snapshot();

      expect(await reactRouterSetup.syncLoader(ctx('app/_gt'))).toEqual({
        steps: [],
        manualActions: [],
      });
      expect(snapshot()).toEqual(files);
    });

    // The root never imports the file, so its exports do not matter.
    it('ignores a loader file a root it has not configured never imports', async () => {
      write('app/loadTranslations.ts', 'export async function load() {}\n');

      expect(
        await reactRouterSetup.syncLoader({
          ...ctx('app/_gt'),
          previousTranslationsDir: 'app/_gt',
        })
      ).toEqual({ steps: [], manualActions: [] });
    });

    it('only reports what a CDN root needs when app source is kept', async () => {
      await reactRouterSetup.apply(ctx(undefined));
      const files = snapshot();

      const result = await reactRouterSetup.syncLoader({
        ...ctx('app/_gt'),
        keepAppSource: true,
      });

      expect(snapshot()).toEqual(files);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          expect.objectContaining({
            whatHappened:
              'app/loadTranslations.ts was not created because the React setup was skipped',
          }),
          storageAction(LOCAL_STORAGE_CALL),
        ],
      });
    });

    it('only reads an existing loader when app source is kept', async () => {
      await reactRouterSetup.apply(ctx('app/_gt'));
      const files = snapshot();

      const result = await reactRouterSetup.syncLoader({
        ...moved(),
        keepAppSource: true,
      });

      expect(snapshot()).toEqual(files);
      expect(result).toEqual({
        steps: [],
        manualActions: [
          {
            whatHappened:
              'app/loadTranslations.ts was left unchanged because the React setup was skipped, but translations now go to app/locales',
            fix: 'Update app/loadTranslations.ts to load translations from app/locales',
          },
        ],
      });
    });

    it('reports a custom loader without an export on a local root', async () => {
      await reactRouterSetup.apply(ctx('app/_gt'));
      write(
        'app/loadTranslations.ts',
        'export async function fetchTranslations() {\n  return {};\n}\n'
      );

      const result = await reactRouterSetup.syncLoader({
        ...ctx('app/_gt'),
        previousTranslationsDir: 'app/_gt',
      });

      expect(result).toEqual({
        steps: [],
        manualActions: [
          expect.objectContaining({ whatHappened: MISSING_EXPORT }),
        ],
      });
    });
  });
});
