import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRoutingConfig } from '../config/parseRoutingConfig.js';

const tmpDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-routing-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('parseRoutingConfig', () => {
  it('extracts a canonical defineRouting config', () => {
    const cwd = makeProject({
      'src/i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'es', 'ja'],",
        "  defaultLocale: 'en',",
        '});',
      ].join('\n'),
      'src/i18n/request.ts': '// request config',
    });
    const result = parseRoutingConfig(cwd);
    expect(result.locales).toEqual(['en', 'es', 'ja']);
    expect(result.defaultLocale).toBe('en');
    expect(result.localePrefix).toBeNull();
    expect(result.pathnames).toBeNull();
    expect(result.routingFile).toBe(path.join(cwd, 'src/i18n/routing.ts'));
    expect(result.requestFile).toBe(path.join(cwd, 'src/i18n/request.ts'));
  });

  it('unwraps as-const assertions and reads string localePrefix', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'de'] as const,",
        "  defaultLocale: 'en' as const,",
        "  localePrefix: 'always',",
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.locales).toEqual(['en', 'de']);
    expect(result.localePrefix).toBe('always');
  });

  it('reads localePrefix object form via its mode', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'fr'],",
        "  defaultLocale: 'en',",
        "  localePrefix: { mode: 'as-needed' },",
        '});',
      ].join('\n'),
    });
    expect(parseRoutingConfig(cwd).localePrefix).toBe('as-needed');
  });

  it('captures literal pathnames verbatim', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'de'],",
        "  defaultLocale: 'en',",
        '  pathnames: {',
        "    '/': '/',",
        "    '/about': { en: '/about', de: '/ueber-uns' },",
        '  },',
        '});',
      ].join('\n'),
    });
    expect(parseRoutingConfig(cwd).pathnames).toEqual({
      '/': '/',
      '/about': { en: '/about', de: '/ueber-uns' },
    });
  });

  it('flags a shorthand variable localePrefix as unresolved', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        "const localePrefix = 'as-needed';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'fr'],",
        "  defaultLocale: 'en',",
        '  localePrefix,',
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.localePrefix).toBeNull();
    expect(result.localePrefixUnresolved).toBe(true);
  });

  it('flags an object localePrefix with a dynamic mode as unresolved', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'fr'],",
        "  defaultLocale: 'en',",
        '  localePrefix: { mode: prefixMode },',
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.localePrefix).toBeNull();
    expect(result.localePrefixUnresolved).toBe(true);
  });

  it('flags a referenced pathnames as unresolved', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        "const pathnames = { '/about': '/about' };",
        'export const routing = defineRouting({',
        "  locales: ['en', 'de'],",
        "  defaultLocale: 'en',",
        '  pathnames,',
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.pathnames).toBeNull();
    expect(result.pathnamesUnresolved).toBe(true);
  });

  it('leaves both unresolved flags unset when localePrefix and pathnames are absent', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'es'],",
        "  defaultLocale: 'en',",
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.localePrefix).toBeNull();
    expect(result.localePrefixUnresolved).toBeFalsy();
    expect(result.pathnames).toBeNull();
    expect(result.pathnamesUnresolved).toBeFalsy();
  });

  it('resolves literal localePrefix and pathnames without setting unresolved flags', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        'export const routing = defineRouting({',
        "  locales: ['en', 'de'],",
        "  defaultLocale: 'en',",
        "  localePrefix: 'as-needed',",
        '  pathnames: {',
        "    '/about': { en: '/about', de: '/ueber-uns' },",
        '  },',
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.localePrefix).toBe('as-needed');
    expect(result.localePrefixUnresolved).toBeFalsy();
    expect(result.pathnames).toEqual({
      '/about': { en: '/about', de: '/ueber-uns' },
    });
    expect(result.pathnamesUnresolved).toBeFalsy();
  });

  it('returns null fields for values it cannot statically resolve', () => {
    const cwd = makeProject({
      'i18n/routing.ts': [
        "import { defineRouting } from 'next-intl/routing';",
        "import { LOCALES } from './constants';",
        'export const routing = defineRouting({',
        '  locales: LOCALES,',
        "  defaultLocale: 'en',",
        '  ...extra,',
        '});',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.locales).toBeNull();
    expect(result.defaultLocale).toBe('en');
  });

  it('falls back to a plain exported object with locales/defaultLocale', () => {
    const cwd = makeProject({
      'i18n.ts': [
        'export const routing = {',
        "  locales: ['en', 'pt'],",
        "  defaultLocale: 'pt',",
        '};',
      ].join('\n'),
    });
    const result = parseRoutingConfig(cwd);
    expect(result.locales).toEqual(['en', 'pt']);
    expect(result.defaultLocale).toBe('pt');
  });

  it('returns all-null info when no routing files exist', () => {
    const cwd = makeProject({ 'src/app/page.tsx': 'export {}' });
    expect(parseRoutingConfig(cwd)).toEqual({
      locales: null,
      defaultLocale: null,
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
    });
  });
});
