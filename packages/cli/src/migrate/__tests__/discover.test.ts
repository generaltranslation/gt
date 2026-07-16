import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverCatalogs } from '../discover.js';
import type { RoutingInfo } from '../types.js';

const emptyRouting: RoutingInfo = {
  locales: null,
  defaultLocale: null,
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

const tmpDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-discover-'));
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

describe('discoverCatalogs', () => {
  it('finds catalogs in the standard messages/ directory', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ Home: { title: 'Hello' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Hola' } }),
    });
    const result = await discoverCatalogs(cwd, emptyRouting);
    expect(result).not.toBeNull();
    expect(result!.dir).toBe(path.join(cwd, 'messages'));
    expect(result!.defaultLocale).toBe('en');
    expect(result!.locales.sort()).toEqual(['en', 'es']);
    expect(result!.byLocale.en).toEqual({ Home: { title: 'Hello' } });
  });

  it('uses the directory referenced by the request config dynamic import', async () => {
    const cwd = makeProject({
      'src/i18n/request.ts': [
        "import { getRequestConfig } from 'next-intl/server';",
        'export default getRequestConfig(async ({ requestLocale }) => {',
        '  const locale = (await requestLocale) ?? \'en\';',
        '  return {',
        '    locale,',
        '    messages: (await import(`../../content/i18n/${locale}.json`)).default,',
        '  };',
        '});',
      ].join('\n'),
      'content/i18n/en.json': JSON.stringify({ a: 'A' }),
      'content/i18n/de.json': JSON.stringify({ a: 'B' }),
    });
    const routing: RoutingInfo = {
      ...emptyRouting,
      requestFile: path.join(cwd, 'src/i18n/request.ts'),
    };
    const result = await discoverCatalogs(cwd, routing);
    expect(result).not.toBeNull();
    expect(result!.dir).toBe(path.join(cwd, 'content/i18n'));
    expect(result!.locales.sort()).toEqual(['de', 'en']);
  });

  it('prefers routing defaultLocale and filters to routing locales', async () => {
    const cwd = makeProject({
      'messages/en.json': '{}',
      'messages/fr.json': '{}',
      'messages/draft.json': '{}',
    });
    const routing: RoutingInfo = {
      ...emptyRouting,
      locales: ['en', 'fr'],
      defaultLocale: 'fr',
    };
    const result = await discoverCatalogs(cwd, routing);
    expect(result!.defaultLocale).toBe('fr');
    expect(result!.locales.sort()).toEqual(['en', 'fr']);
    expect(result!.byLocale.draft).toBeUndefined();
  });

  it('falls back to the single catalog locale as default', async () => {
    const cwd = makeProject({
      'src/messages/nl.json': JSON.stringify({ x: 'y' }),
    });
    const result = await discoverCatalogs(cwd, emptyRouting);
    expect(result!.defaultLocale).toBe('nl');
    expect(result!.locales).toEqual(['nl']);
  });

  it('returns null when no catalogs exist', async () => {
    const cwd = makeProject({ 'src/app/page.tsx': 'export {}' });
    expect(await discoverCatalogs(cwd, emptyRouting)).toBeNull();
  });

  it('returns null when multiple locales exist but no default is determinable', async () => {
    const cwd = makeProject({
      'messages/fr.json': '{}',
      'messages/de.json': '{}',
    });
    expect(await discoverCatalogs(cwd, emptyRouting)).toBeNull();
  });
});
