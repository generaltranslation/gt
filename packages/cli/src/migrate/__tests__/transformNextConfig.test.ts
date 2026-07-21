import { describe, expect, it } from 'vitest';
import { transformNextConfigFile } from '../transformNextConfig.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(skipped: string[] = []): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing,
    edits: [],
    todos: [],
    skippedFiles: new Map(skipped.map((file) => [file, ['reason']])),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

describe('transformNextConfigFile', () => {
  it('unwraps the assigned-wrapper form', () => {
    const code = [
      "import createNextIntlPlugin from 'next-intl/plugin';",
      "import type { NextConfig } from 'next';",
      'const withNextIntl = createNextIntlPlugin();',
      'const nextConfig: NextConfig = { reactStrictMode: true };',
      'export default withNextIntl(nextConfig);',
    ].join('\n');
    const result = transformNextConfigFile(
      '/project/next.config.ts',
      code,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /import \{ withGTConfig \} from ["']gt-next\/config["']/
    );
    expect(result.code).toMatch(
      /export default withGTConfig\(nextConfig, \{\s*dictionary: ["']\.\/messages\/en\.json["'],?\s*\}\)/
    );
    expect(result.code).not.toContain('createNextIntlPlugin');
    expect(result.code).not.toContain('withNextIntl');
    expect(result.code).toContain('reactStrictMode: true');
  });

  it('unwraps the inline-call form with a request path argument', () => {
    const code = [
      "import createNextIntlPlugin from 'next-intl/plugin';",
      'const nextConfig = {};',
      "export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);",
    ].join('\n');
    const result = transformNextConfigFile(
      '/project/next.config.mjs',
      code,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/export default withGTConfig\(nextConfig,/);
    expect(result.code).not.toContain('next-intl/plugin');
  });

  it('keeps the next-intl plugin composed around withGTConfig while skips exist', () => {
    const code = [
      "import createNextIntlPlugin from 'next-intl/plugin';",
      "const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');",
      'const nextConfig = { reactStrictMode: true };',
      'export default withNextIntl(nextConfig);',
    ].join('\n');
    const result = transformNextConfigFile(
      '/project/next.config.ts',
      code,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // the retained provider needs the plugin's request-config alias
    expect(result.code).toContain("from 'next-intl/plugin'");
    expect(result.code).toContain(
      "createNextIntlPlugin('./src/i18n/request.ts')"
    );
    expect(result.code).toMatch(
      /export default withNextIntl\(\s*withGTConfig\(nextConfig, \{\s*dictionary: ["']\.\/messages\/en\.json["'],?\s*\}\)\s*\)/
    );
    expect(
      result.todos.some((todo) => todo.reason.includes('createNextIntlPlugin'))
    ).toBe(true);
    // the teardown re-run guidance must carry --from, since the flag is
    // required and the re-run has to name the source library explicitly.
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('gt migrate --from next-intl')
      )
    ).toBe(true);
  });

  it('returns unchanged when no next-intl plugin is present', () => {
    const result = transformNextConfigFile(
      '/project/next.config.ts',
      'export default {};',
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([]);
  });
});
