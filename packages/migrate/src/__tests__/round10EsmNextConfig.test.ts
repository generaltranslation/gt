import { describe, expect, it } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';

registerTreeCleanup();

/** A next-intl app whose next.config loads as native ESM. */
function makeApp(configFile: string, packageJsonExtra: object = {}) {
  return makeTree(
    {
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '16.0.0',
          'next-intl': '^4.1.0',
          react: '19.0.0',
        },
        ...packageJsonExtra,
      }),
      'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
      [configFile]: [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        'const withNextIntl = createNextIntlPlugin();',
        'export default withNextIntl({});',
      ].join('\n'),
      'src/app/[locale]/page.tsx': [
        "import { useTranslations } from 'next-intl';",
        'export default function Home() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
    },
    { prefix: 'gt-migrate-r10-esm-' }
  );
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

describe('r10 finding 4: the native-ESM next.config TODO states the measured truth', () => {
  it('carries no version bound and names the version it was measured on', async () => {
    const ctx = await run(makeApp('next.config.mjs'));
    const todo = ctx.todos.find((entry) =>
      /require is not defined/.test(entry.reason)
    );
    expect(todo).toBeDefined();
    const reason = todo!.reason;
    // The bound this replaces was `<= 11.0.9`, which read as "not me" to every
    // user on the version `gt migrate` actually installs. Measured: 11.1.0
    // fails identically, and so does the current gt-next source.
    expect(reason).not.toMatch(/11\.0\.9/);
    expect(reason).not.toMatch(/<=/);
    expect(reason).toMatch(/11\.1\.0/);
    expect(reason).toMatch(/next\.config\.ts/);
  });

  it('also surfaces the failure as a top-level warning, not only a TODO', async () => {
    const ctx = await run(makeApp('next.config.mjs'));
    const warning = (ctx.warnings ?? []).find((entry) =>
      /require is not defined/.test(entry)
    );
    expect(warning).toBeDefined();
    expect(warning!).toMatch(/next\.config\.ts/);
  });

  it('fires for a .js config in a "type": "module" package too', async () => {
    const ctx = await run(makeApp('next.config.js', { type: 'module' }));
    expect(
      ctx.todos.some((entry) => /require is not defined/.test(entry.reason))
    ).toBe(true);
    expect(
      (ctx.warnings ?? []).some((entry) => /require is not defined/.test(entry))
    ).toBe(true);
  });

  it('stays silent for a next.config.ts project', async () => {
    const ctx = await run(makeApp('next.config.ts'));
    expect(
      ctx.todos.some((entry) => /require is not defined/.test(entry.reason))
    ).toBe(false);
    expect(
      (ctx.warnings ?? []).some((entry) => /require is not defined/.test(entry))
    ).toBe(false);
  });
});
