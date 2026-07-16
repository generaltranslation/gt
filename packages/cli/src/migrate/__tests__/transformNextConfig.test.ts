import { describe, expect, it } from 'vitest';
import { transformNextConfigFile } from '../transformNextConfig.js';
import type { MessageCatalogs, MigrationContext, RoutingInfo } from '../types.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(): MigrationContext {
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
    skippedFiles: new Map(),
    stats: {},
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
