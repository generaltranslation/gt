import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AstroIntegrationLogger } from 'astro';

// The compiler's CJS dist doesn't load cleanly under vitest's ESM interop;
// these tests only assert gt-astro's wiring around it.
vi.mock('@generaltranslation/compiler', () => ({
  vite: (options: object) => ({
    name: '@generaltranslation/GT_PLUGIN',
    _options: options,
  }),
}));

const { gtAstro } = await import('../index');
import {
  SERVER_CONFIG_MODULE_ID,
  createVirtualConfigPlugin,
} from '../integration/virtualConfig';

const GT_CONFIG = {
  defaultLocale: 'en',
  locales: ['fr', 'zh'],
};

function createFixtureRoot(gtConfig: object | null = GT_CONFIG): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-astro-test-'));
  if (gtConfig) {
    fs.writeFileSync(
      path.join(root, 'gt.config.json'),
      JSON.stringify(gtConfig)
    );
  }
  return root;
}

function runConfigSetup(
  options: Parameters<typeof gtAstro>[0],
  {
    root,
    command = 'build',
    i18n,
  }: { root: string; command?: 'dev' | 'build'; i18n?: object } = {
    root: createFixtureRoot(),
  }
) {
  const integration = gtAstro(options);
  const updates: object[] = [];
  const middleware: object[] = [];
  const scripts: Array<[string, string]> = [];
  const logger = {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as AstroIntegrationLogger;

  const setup = integration.hooks['astro:config:setup'];
  if (!setup) throw new Error('missing astro:config:setup hook');
  setup({
    addMiddleware: (entry: object) => middleware.push(entry),
    addWatchFile: vi.fn(),
    command,
    config: { root: pathToFileURL(root + path.sep), i18n },
    injectScript: (stage: string, content: string) =>
      scripts.push([stage, content]),
    logger,
    updateConfig: (update: object) => updates.push(update),
  } as never);

  return { updates, middleware, scripts, logger };
}

describe('gtAstro astro:config:setup', () => {
  it('registers middleware, the client script, and vite plugins', () => {
    const root = createFixtureRoot();
    const { updates, middleware, scripts } = runConfigSetup({}, { root });

    expect(middleware).toEqual([
      { entrypoint: 'gt-astro/middleware', order: 'pre' },
    ]);
    expect(scripts).toHaveLength(1);
    expect(scripts[0][0]).toBe('before-hydration');
    expect(scripts[0][1]).toContain(
      `import { initializeGTAstroClient } from 'gt-astro/client';`
    );
    expect(scripts[0][1]).toContain('"defaultLocale":"en"');
    expect(scripts[0][1]).not.toContain('apiKey');

    const viteUpdate = updates.find(
      (update) => 'vite' in update
    ) as unknown as {
      vite: { plugins: Array<{ name: string; enforce?: string }> };
    };
    expect(viteUpdate.vite.plugins.map((plugin) => plugin.name)).toEqual([
      'gt-astro:config',
      '@generaltranslation/GT_PLUGIN',
    ]);
    expect(viteUpdate.vite.plugins[1].enforce).toBe('post');
  });

  it('derives Astro i18n config from gt.config.json', () => {
    const root = createFixtureRoot();
    const { updates } = runConfigSetup({}, { root });
    const i18nUpdate = updates.find((update) => 'i18n' in update);
    expect(i18nUpdate).toEqual({
      i18n: {
        defaultLocale: 'en',
        locales: ['en', 'fr', 'zh'],
        routing: {
          prefixDefaultLocale: true,
          redirectToDefaultLocale: false,
          fallbackType: 'redirect',
        },
      },
    });
  });

  it('respects an existing Astro i18n config', () => {
    const root = createFixtureRoot();
    const { updates } = runConfigSetup(
      {},
      { root, i18n: { defaultLocale: 'en', locales: ['en'] } }
    );
    expect(updates.find((update) => 'i18n' in update)).toBeUndefined();
  });

  it('omits the compiler plugin when disabled', () => {
    const root = createFixtureRoot();
    const { updates } = runConfigSetup({ compiler: false }, { root });
    const viteUpdate = updates.find(
      (update) => 'vite' in update
    ) as unknown as {
      vite: { plugins: Array<{ name: string }> };
    };
    expect(viteUpdate.vite.plugins.map((plugin) => plugin.name)).toEqual([
      'gt-astro:config',
    ]);
  });

  it('warns when gt.config.json is missing', () => {
    const root = createFixtureRoot(null);
    const { logger } = runConfigSetup({}, { root });
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('createVirtualConfigPlugin', () => {
  it('serves the server config module', () => {
    const plugin = createVirtualConfigPlugin({
      serverConfig: {
        defaultLocale: 'en',
        locales: ['fr'],
        apiKey: 'secret',
      },
      settings: { localeRouting: true },
    });

    const resolvedServer = plugin.resolveId?.(SERVER_CONFIG_MODULE_ID);
    expect(resolvedServer).toBe('\0' + SERVER_CONFIG_MODULE_ID);
    const serverCode = plugin.load?.(resolvedServer!);
    expect(serverCode).toContain('"apiKey":"secret"');
    expect(serverCode).toContain('"localeRouting":true');
    expect(serverCode).toContain('export const loadTranslations = undefined;');
  });

  it('re-exports loadTranslations from the app module when configured', () => {
    const plugin = createVirtualConfigPlugin({
      serverConfig: { defaultLocale: 'en', locales: ['fr'] },
      settings: { localeRouting: false },
      loadTranslationsPath: '/app/src/loadTranslations.ts',
    });
    const code = plugin.load?.('\0' + SERVER_CONFIG_MODULE_ID);
    expect(code).toContain(
      `export { loadTranslations } from "/app/src/loadTranslations.ts";`
    );
  });

  it('ignores unrelated module ids', () => {
    const plugin = createVirtualConfigPlugin({
      serverConfig: { defaultLocale: 'en', locales: ['fr'] },
      settings: { localeRouting: true },
    });
    expect(plugin.resolveId?.('some-module')).toBeUndefined();
    expect(plugin.load?.('some-module')).toBeUndefined();
  });
});
