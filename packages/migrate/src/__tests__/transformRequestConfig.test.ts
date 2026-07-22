import { describe, expect, it } from 'vitest';
import { transformRequestConfigFile } from '../transforms/transformRequestConfig.js';

const canonical = [
  "import { getRequestConfig } from 'next-intl/server';",
  "import { hasLocale } from 'next-intl';",
  "import { routing } from './routing';",
  '',
  'export default getRequestConfig(async ({ requestLocale }) => {',
  '  const requested = await requestLocale;',
  '  const locale = hasLocale(routing.locales, requested)',
  '    ? requested',
  '    : routing.defaultLocale;',
  '  return {',
  '    locale,',
  '    messages: (await import(`../../messages/${locale}.json`)).default,',
  '  };',
  '});',
].join('\n');

describe('transformRequestConfigFile', () => {
  it('rewires the requestLocale fallback through getLocale()', () => {
    const result = transformRequestConfigFile('src/i18n/request.ts', canonical);
    expect(result.skipReasons).toEqual([]);
    expect(result.todos).toEqual([]);
    // param renamed, shadow wrapper injected
    expect(result.code).toContain('requestLocale: _gtRequestLocale');
    expect(result.code).toContain('_gtRequestLocale.then');
    expect(result.code).toMatch(/requested \?\? \(?await getLocale\(\)\)?/);
    expect(result.code).toMatch(
      /import \{ getLocale \} from ["']gt-next\/server["']/
    );
    // downstream body untouched
    expect(result.code).toContain('hasLocale(routing.locales, requested)');
  });

  it('emits a todo when the shape is not recognized', () => {
    const exotic = [
      "import { getRequestConfig } from 'next-intl/server';",
      'const factory = () => ({ locale: "en", messages: {} });',
      'export default getRequestConfig(factory);',
    ].join('\n');
    const result = transformRequestConfigFile('src/i18n/request.ts', exotic);
    expect(result.code).toBeNull();
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].reason).toContain('getLocale');
  });

  it('returns unchanged for files without getRequestConfig', () => {
    const result = transformRequestConfigFile(
      'src/i18n/request.ts',
      'export const x = 1;'
    );
    expect(result.code).toBeNull();
    expect(result.todos).toEqual([]);
  });
});
