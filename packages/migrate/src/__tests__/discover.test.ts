import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { discoverCatalogs } from '../catalogs/discover.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { RoutingInfo } from '../pipeline/types.js';

// discoverCatalogs surfaces its one advisory through the injected io (the CLI
// wires io.warn to its logger); a fake records the calls.
function makeIO() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    guardGit: vi.fn(),
    promptConfirm: vi.fn(),
    promptText: vi.fn(),
    promptLocale: vi.fn(),
    promptLocaleList: vi.fn(),
  } satisfies MigrateIO;
}
let io: ReturnType<typeof makeIO>;

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

beforeEach(() => {
  vi.clearAllMocks();
  io = makeIO();
});

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('discoverCatalogs', () => {
  it('reports the offending file and the fix guidance when a catalog is malformed', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ Home: { title: 'Hello' } }),
      'messages/es.json': '{ "Home": { "title": "Hola", } }', // trailing comma
    });
    // Uses the standard diagnostic messaging system: the message names the
    // offending file and carries the existing fix guidance (formatting is not
    // asserted).
    await expect(discoverCatalogs(cwd, emptyRouting)).rejects.toThrow(
      /es\.json/
    );
    await expect(discoverCatalogs(cwd, emptyRouting)).rejects.toThrow(
      /trailing commas/
    );
  });

  it('defaults to libraryDefaultLocale when present and no routing default', async () => {
    const other = libraryDefaultLocale === 'es' ? 'fr' : 'es';
    const cwd = makeProject({
      [`messages/${libraryDefaultLocale}.json`]: JSON.stringify({ a: 'A' }),
      [`messages/${other}.json`]: JSON.stringify({ a: 'B' }),
    });
    const result = await discoverCatalogs(cwd, emptyRouting);
    expect(result!.defaultLocale).toBe(libraryDefaultLocale);
    expect(result!.locales).toContain(libraryDefaultLocale);
    expect(result!.locales).toContain(other);
  });

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
        "  const locale = (await requestLocale) ?? 'en';",
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

  it('returns null and warns naming the missing locale when a routing locale has no catalog', async () => {
    const cwd = makeProject({
      'messages/en.json': '{}',
      'messages/es.json': '{}',
    });
    const routing: RoutingInfo = {
      ...emptyRouting,
      locales: ['en', 'es', 'fr'],
      defaultLocale: 'en',
    };
    expect(await discoverCatalogs(cwd, routing, io)).toBeNull();
    expect(io.warn).toHaveBeenCalledTimes(1);
    const message = vi.mocked(io.warn).mock.calls[0][0];
    expect(message).toMatch(/fr/);
    expect(message).toContain(path.join(cwd, 'messages'));
  });

  it('keeps stem-driven behavior and does not warn when routing locales are null', async () => {
    const cwd = makeProject({
      'messages/en.json': '{}',
      'messages/es.json': '{}',
    });
    const result = await discoverCatalogs(cwd, emptyRouting, io);
    expect(result!.locales.sort()).toEqual(['en', 'es']);
    expect(io.warn).not.toHaveBeenCalled();
  });

  it('does not warn when every routing locale has a catalog', async () => {
    const cwd = makeProject({
      'messages/en.json': '{}',
      'messages/fr.json': '{}',
    });
    const routing: RoutingInfo = {
      ...emptyRouting,
      locales: ['en', 'fr'],
      defaultLocale: 'en',
    };
    const result = await discoverCatalogs(cwd, routing, io);
    expect(result!.locales.sort()).toEqual(['en', 'fr']);
    expect(io.warn).not.toHaveBeenCalled();
  });

  it('carries the parse error under Details rather than inline in whatHappened', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ a: 'A' }),
      'messages/es.json': '{ "a": "b", }', // trailing comma
    });
    let message = '';
    try {
      await discoverCatalogs(cwd, emptyRouting);
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/Details:/);
    // The raw parser error lives under Details, not inline after the filename.
    const beforeDetails = message.split('Details:')[0];
    expect(beforeDetails).not.toMatch(/SyntaxError/);
  });
});
