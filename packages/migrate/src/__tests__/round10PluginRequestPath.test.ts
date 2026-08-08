import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRoutingConfig } from '../config/parseRoutingConfig.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';

registerTreeCleanup();

const ROUTING = [
  "import { defineRouting } from 'next-intl/routing';",
  'export const routing = defineRouting({',
  "  locales: ['en', 'pt'],",
  "  defaultLocale: 'en',",
  '});',
].join('\n');

const makeProject = (files: Record<string, string>) =>
  makeTree(files, { prefix: 'gt-migrate-r10-plugin-' });

describe('r10 finding 8: the plugin path argument locates the request config', () => {
  it('reads a string argument at a non-default path', () => {
    const cwd = makeProject({
      'next.config.mjs': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        "const withNextIntl = createNextIntlPlugin('./src/i18n/messages.ts');",
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'src/i18n/messages.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'src/i18n/messages.ts')
    );
  });

  it('reads the requestConfig property of the object argument', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        'const withNextIntl = createNextIntlPlugin({',
        "  requestConfig: './config/i18n.ts',",
        '});',
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'config/i18n.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'config/i18n.ts')
    );
  });

  it('leaves the conventional path alone when the plugin takes no argument', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        'const withNextIntl = createNextIntlPlugin();',
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'src/i18n/request.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'src/i18n/request.ts')
    );
  });

  it('falls back to the conventional path when the argument names no file', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        "const withNextIntl = createNextIntlPlugin('./gone/nowhere.ts');",
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'src/i18n/request.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'src/i18n/request.ts')
    );
  });

  it('ignores a dynamic argument rather than guessing', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        'const where = process.env.I18N_PATH;',
        'const withNextIntl = createNextIntlPlugin(where);',
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'src/i18n/request.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'src/i18n/request.ts')
    );
  });

  it('ignores a same-named call that is not the next-intl plugin', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from './lib/notThePlugin';",
        "const withNextIntl = createNextIntlPlugin('./src/i18n/messages.ts');",
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
      'src/i18n/messages.ts': '// not the request config',
      'src/i18n/request.ts': '// the request config',
    });
    expect(parseRoutingConfig(cwd).requestFile).toBe(
      path.join(cwd, 'src/i18n/request.ts')
    );
  });

  it('stays null when neither the plugin nor a conventional path names one', () => {
    const cwd = makeProject({
      'next.config.ts': [
        "import createNextIntlPlugin from 'next-intl/plugin';",
        'const withNextIntl = createNextIntlPlugin();',
        'export default withNextIntl({});',
      ].join('\n'),
      'src/i18n/routing.ts': ROUTING,
    });
    expect(parseRoutingConfig(cwd).requestFile).toBeNull();
  });
});

describe('r10 finding 8: the resolved custom path joins the teardown', () => {
  it('deletes the plugin-named request config on a full migration', async () => {
    const cwd = makeTree(
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
        'messages/pt.json': JSON.stringify({ Home: { title: 'Ola' } }),
        'next.config.mjs': [
          "import createNextIntlPlugin from 'next-intl/plugin';",
          "const withNextIntl = createNextIntlPlugin('./src/i18n/messages.ts');",
          'export default withNextIntl({});',
        ].join('\n'),
        'src/i18n/routing.ts': ROUTING,
        'src/i18n/messages.ts': [
          "import { getRequestConfig } from 'next-intl/server';",
          'export default getRequestConfig(async () => ({ locale: "en", messages: {} }));',
        ].join('\n'),
        'src/app/[locale]/page.tsx': [
          "import { useTranslations } from 'next-intl';",
          'export default function Home() {',
          "  const t = useTranslations('Home');",
          "  return <h1>{t('title')}</h1>;",
          '}',
        ].join('\n'),
      },
      { prefix: 'gt-migrate-r10-plugin-td-' }
    );
    const ctx = await runMigration(
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
    // Without the plugin-argument read this file was invisible to the engine:
    // it went through the generic source pass, skipped as an unsupported API,
    // and held the whole teardown back.
    expect(ctx.skippedFiles.size).toBe(0);
    expect(
      ctx.edits.some(
        (edit) =>
          edit.kind === 'delete' &&
          edit.path === path.join(cwd, 'src/i18n/messages.ts')
      )
    ).toBe(true);
  });
});
