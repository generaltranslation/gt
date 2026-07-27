import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';
import type { MigrationContext } from '../pipeline/types.js';

// Round-10 finding 1: next/root-params throws inside a Route Handler or Server
// Action, so a converted translation call there 500s. Both answers are pinned
// here, over the real pipeline: the guarded resolver and registerLocale.

registerTreeCleanup();

const lines = (...parts: string[]) => parts.join('\n') + '\n';

/** A [locale] root layout that migrates cleanly (the shape every fixture has). */
const localeLayout = lines(
  "import { NextIntlClientProvider } from 'next-intl';",
  "import { setRequestLocale } from 'next-intl/server';",
  'export function generateStaticParams() {',
  "  return [{ locale: 'en' }, { locale: 'de' }];",
  '}',
  'export default async function LocaleLayout({',
  '  children,',
  '  params,',
  '}: {',
  '  children: React.ReactNode;',
  '  params: Promise<{ locale: string }>;',
  '}) {',
  '  const { locale } = await params;',
  '  setRequestLocale(locale);',
  '  return (',
  '    <html lang={locale}>',
  '      <body>',
  '        <NextIntlClientProvider>{children}</NextIntlClientProvider>',
  '      </body>',
  '    </html>',
  '  );',
  '}'
);

const serverPage = lines(
  "import { getTranslations } from 'next-intl/server';",
  'export default async function Home() {',
  "  const t = await getTranslations('Home');",
  "  return <h1>{t('title')}</h1>;",
  '}'
);

/** The deskly Route Handler, verbatim in shape: params -> getTranslations. */
const statusRoute = lines(
  "import { getTranslations } from 'next-intl/server';",
  'export async function GET(',
  '  _request: Request,',
  '  { params }: { params: Promise<{ locale: string }> }',
  ') {',
  '  const { locale } = await params;',
  "  const t = await getTranslations({ locale, namespace: 'Status' });",
  "  return Response.json({ locale, message: t('ok') });",
  '}'
);

const baseFiles: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '16.2.3', 'next-intl': '^4.13.3', react: '19.2.0' },
  }),
  'messages/en.json': JSON.stringify({
    Home: { title: 'Welcome' },
    Status: { ok: 'All systems operational' },
  }),
  'messages/de.json': JSON.stringify({
    Home: { title: 'Willkommen' },
    Status: { ok: 'Alle Systeme betriebsbereit' },
  }),
  'src/app/[locale]/layout.tsx': localeLayout,
  'src/app/[locale]/page.tsx': serverPage,
};

function makeApp(overrides: Record<string, string> = {}): string {
  return makeTree(
    { ...baseFiles, ...overrides },
    { prefix: 'gt-migrate-r10entry-' }
  );
}

const migrate = (cwd: string) =>
  runMigration(
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

const written = (ctx: MigrationContext, relative: string) =>
  ctx.edits.find(
    (edit) =>
      edit.kind === 'write' && edit.path === path.join(ctx.cwd, relative)
  )?.content ?? null;

const emittedResolvers = (ctx: MigrationContext) =>
  ctx.edits.filter(
    (edit) => edit.kind === 'write' && /get(Locale|Region)\.ts$/.test(edit.path)
  );

const skipReason = (ctx: MigrationContext, relative: string) =>
  (ctx.skippedFiles.get(path.join(ctx.cwd, relative)) ?? []).join(' ');

const todoText = (ctx: MigrationContext, relative: string) =>
  ctx.todos
    .filter((todo) => todo.file === path.join(ctx.cwd, relative))
    .map((todo) => todo.reason)
    .join('\n');

describe('round 10 finding 1: Route Handlers under [locale]', () => {
  it('registers the route locale so the converted handler resolves it', async () => {
    const cwd = makeApp({
      'src/app/[locale]/api/status/route.ts': statusRoute,
    });
    const ctx = await migrate(cwd);

    const code = written(ctx, 'src/app/[locale]/api/status/route.ts');
    expect(code).not.toBeNull();
    // Converted, not skipped: the locale IS reachable here (it is a route param).
    expect(
      ctx.skippedFiles.has(
        path.join(cwd, 'src/app/[locale]/api/status/route.ts')
      )
    ).toBe(false);
    // registerLocale is gt-next's documented answer for Route Handlers, where
    // next/root-params throws.
    expect(code).toMatch(
      /import \{[^}]*registerLocale[^}]*\} from ['"]gt-next\/server['"]/
    );
    expect(code).toContain('registerLocale');
    // registerLocale's contract: it runs ahead of the first gt-next call.
    const registerAt = code!.indexOf('registerLocale(');
    const translateAt = code!.indexOf('getTranslations(');
    expect(registerAt).toBeGreaterThan(-1);
    expect(registerAt).toBeLessThan(translateAt);
    // and it must read the route param, not a guess.
    expect(code).toMatch(/registerLocale\(\(await params\)\.locale\)/);
  });

  it('keeps the static locale resolvers (no SSG cost for the handler fix)', async () => {
    const cwd = makeApp({
      'src/app/[locale]/api/status/route.ts': statusRoute,
    });
    const ctx = await migrate(cwd);

    expect(emittedResolvers(ctx)).toHaveLength(2);
  });

  it('reports the handler it registered a locale in', async () => {
    const cwd = makeApp({
      'src/app/[locale]/api/status/route.ts': statusRoute,
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('Route Handler');
    expect(report).toContain('registerLocale');
  });

  it('never claims the dropped locale override resolves itself in a handler', async () => {
    const cwd = makeApp({
      'src/app/[locale]/api/status/route.ts': statusRoute,
    });
    const ctx = await migrate(cwd);

    const routeTodos = ctx.todos.filter(
      (todo) =>
        todo.file === path.join(cwd, 'src/app/[locale]/api/status/route.ts')
    );
    // The round-9 TODO said "gt-next resolves the request locale itself", which
    // is false in a Route Handler unless something registers it.
    for (const todo of routeTodos) {
      if (todo.reason.includes('gt-next resolves the request locale itself')) {
        expect(todo.reason).toContain('registerLocale');
      }
    }
  });

  it('states the caveat for a Route Handler with no [locale] segment', async () => {
    // Nothing to register, but nothing throws either (the guarded resolver), so
    // the file converts and the TODO names what the locale now depends on.
    const cwd = makeApp({
      'src/app/api/health/route.ts': lines(
        "import { getTranslations } from 'next-intl/server';",
        'export async function GET() {',
        "  const t = await getTranslations('Status');",
        "  return Response.json({ message: t('ok') });",
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(skipReason(ctx, 'src/app/api/health/route.ts')).toBe('');
    const code = written(ctx, 'src/app/api/health/route.ts');
    expect(code).toContain('gt-next/server');
    expect(code).not.toContain('registerLocale');
    const reason = todoText(ctx, 'src/app/api/health/route.ts');
    expect(reason).toContain('Route Handler');
    expect(reason).toContain('[locale] route segment');
    expect(reason).toContain('default locale');
  });

  it('registers each handler only once, and only where it is needed', async () => {
    const cwd = makeApp({
      'src/app/[locale]/api/status/route.ts': lines(
        "import { getTranslations } from 'next-intl/server';",
        'export async function GET(',
        '  _request: Request,',
        '  { params }: { params: Promise<{ locale: string }> }',
        ') {',
        "  const t = await getTranslations('Status');",
        "  return Response.json({ message: t('ok') });",
        '}',
        'export function OPTIONS() {',
        '  return new Response(null, { status: 204 });',
        '}'
      ),
    });
    const ctx = await migrate(cwd);
    const code = written(ctx, 'src/app/[locale]/api/status/route.ts');

    // A sync OPTIONS that never translates must not force the file to hold,
    // and must not be given an unreachable await.
    expect(code).not.toBeNull();
    expect(code!.match(/registerLocale\(/g)).toHaveLength(1);
    expect(code).toContain('export function OPTIONS()');
  });
});

describe('round 10 finding 1: Server Actions', () => {
  const actionModule = lines(
    "'use server';",
    "import { getTranslations } from 'next-intl/server';",
    'export async function ping() {',
    "  const t = await getTranslations('Status');",
    "  return t('ok');",
    '}'
  );

  it("converts a 'use server' module and states what its locale depends on", async () => {
    const cwd = makeApp({ 'src/app/[locale]/actions.ts': actionModule });
    const ctx = await migrate(cwd);

    // Converted, not held: the guarded resolver reads the middleware's locale
    // header, which a Server Action can see (measured on a live POST).
    expect(skipReason(ctx, 'src/app/[locale]/actions.ts')).toBe('');
    expect(written(ctx, 'src/app/[locale]/actions.ts')).toContain(
      'gt-next/server'
    );
    const reason = todoText(ctx, 'src/app/[locale]/actions.ts');
    expect(reason).toMatch(/Server Action|'use server'/);
    expect(reason).toContain('middleware');
    expect(reason).toContain('registerLocale');
  });

  it('notes a page whose INLINE use server function translates', async () => {
    const cwd = makeApp({
      'src/app/[locale]/probe/page.tsx': lines(
        "import { getTranslations } from 'next-intl/server';",
        'export default function Probe() {',
        '  async function run() {',
        "    'use server';",
        "    const t = await getTranslations('Status');",
        "    console.log(t('ok'));",
        '  }',
        '  return <form action={run} />;',
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(todoText(ctx, 'src/app/[locale]/probe/page.tsx')).toMatch(
      /Server Action|'use server'/
    );
  });

  it('still converts a page whose inline action does NOT translate', async () => {
    // No over-reach: the hazard is a gt-next server call inside the action.
    const cwd = makeApp({
      'src/app/[locale]/form/page.tsx': lines(
        "import { getTranslations } from 'next-intl/server';",
        'export default async function FormPage() {',
        "  const t = await getTranslations('Home');",
        '  async function save() {',
        "    'use server';",
        "    console.log('saved');",
        '  }',
        "  return <form action={save}>{t('title')}</form>;",
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(skipReason(ctx, 'src/app/[locale]/form/page.tsx')).toBe('');
    expect(written(ctx, 'src/app/[locale]/form/page.tsx')).toContain(
      'gt-next/server'
    );
  });

  it("names the 'use server' file in the report", async () => {
    const cwd = makeApp({ 'src/app/[locale]/actions.ts': actionModule });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('actions.ts');
    expect(report).toMatch(/Server Action|'use server'/);
  });
});

describe('round 10 finding 1: the emitted resolver', () => {
  const resolver = (ctx: MigrationContext) =>
    ctx.edits.find(
      (edit) => edit.kind === 'write' && edit.path.endsWith('getLocale.ts')
    )?.content ?? '';

  it('guards the root-params call instead of letting it throw', async () => {
    const cwd = makeApp();
    const ctx = await migrate(cwd);
    const code = resolver(ctx);

    expect(code).toContain("import { locale } from 'next/root-params'");
    expect(code).toContain('try {');
    expect(code).toContain('catch');
    // The fallback resolves the request locale; returning the default is what
    // made the probe answer /de in English.
    expect(code).toContain("get('x-generaltranslation-locale')");
  });

  it('falls back to the project default locale, not a hardcoded one', async () => {
    const cwd = makeApp({
      'src/i18n/routing.ts': lines(
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['de', 'en'],",
        "  defaultLocale: 'de',",
        '});'
      ),
    });
    const ctx = await migrate(cwd);

    expect(resolver(ctx)).toContain("?? 'de'");
  });
});
