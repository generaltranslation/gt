import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { transformSourceFile } from '../transforms/transformSource.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';

registerTreeCleanup();

const MIDDLEWARE_BODY = [
  "import createMiddleware from 'next-intl/middleware';",
  "import { routing } from './i18n/routing';",
  'export default createMiddleware(routing);',
  'export const config = {',
  "  matcher: ['/((?!api|_next|.*\\\\..*).*)'],",
  '};',
].join('\n');

function makeContext(routing: Partial<RoutingInfo> = {}): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
      ...routing,
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

/** A minimal but real next-intl app, parameterized by where the middleware sits. */
function makeApp(middlewarePath: string, extra: Record<string, string> = {}) {
  return makeTree(
    {
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '16.0.0',
          'next-intl': '^4.1.0',
          react: '19.0.0',
        },
      }),
      'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
      'src/i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'es'],",
        "  defaultLocale: 'en',",
        '});',
      ].join('\n'),
      'src/app/[locale]/page.tsx': [
        "import { useTranslations } from 'next-intl';",
        'export default function Home() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      [middlewarePath]: MIDDLEWARE_BODY,
      ...extra,
    },
    { prefix: 'gt-migrate-r10-mw-' }
  );
}

/** runMigration buffers edits; the CLI writes them. Read the buffered content. */
function editFor(
  ctx: Awaited<ReturnType<typeof runMigration>>,
  cwd: string,
  relativePath: string
): string {
  const target = path.join(cwd, relativePath);
  const edit = ctx.edits.find(
    (entry) => entry.path === target && entry.kind === 'write'
  );
  expect(edit, `no write edit for ${relativePath}`).toBeDefined();
  return edit!.content ?? '';
}

async function run(cwd: string) {
  return runMigration(
    {
      config: 'gt.config.json',
      from: 'next-intl',
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    'next-intl',
    makeIO(),
    cwd
  );
}

describe('r10 finding 9: proxy.js is a middleware candidate', () => {
  for (const middlewarePath of ['src/proxy.js', 'proxy.js', 'src/proxy.ts']) {
    it(`converts ${middlewarePath} through the middleware lane`, async () => {
      const cwd = makeApp(middlewarePath);
      const ctx = await run(cwd);
      const emitted = editFor(ctx, cwd, middlewarePath);
      expect(emitted).toContain('createNextMiddleware');
      expect(emitted).toContain('gt-next/middleware');
      expect(emitted).not.toContain('next-intl/middleware');
    });
  }

  it('raises the root-middleware TODO for a root proxy file beside a src/ app', async () => {
    const cwd = makeApp('proxy.ts');
    const ctx = await run(cwd);
    const todo = ctx.todos.find((entry) =>
      /Next\.js ignores it there/.test(entry.reason)
    );
    expect(todo).toBeDefined();
    expect(todo!.file).toContain('proxy.ts');
  });
});

describe('r10 finding 9: the unrecognized-middleware skip names the filename', () => {
  it('points a stray next-intl/middleware importer at the path Next.js runs', () => {
    const result = transformSourceFile(
      '/project/src/lib/localeGate.ts',
      MIDDLEWARE_BODY,
      makeContext()
    );
    const reason = result.skipReasons.join(' ');
    // The old wording blamed the import statement ("unsupported next-intl
    // import form"), which a user cannot act on: the import is the documented
    // one. What is actually wrong is where the file sits.
    expect(reason).toMatch(/middleware/i);
    expect(reason).toMatch(/proxy\.ts/);
    expect(reason).not.toMatch(/unsupported next-intl import form/);
  });

  it('leaves other unsupported import forms described as import forms', () => {
    const result = transformSourceFile(
      '/project/src/lib/wild.ts',
      ["import * as intl from 'next-intl';", 'export const x = intl;'].join(
        '\n'
      ),
      makeContext()
    );
    expect(result.skipReasons.join(' ')).toMatch(
      /unsupported next-intl import form/
    );
  });
});
