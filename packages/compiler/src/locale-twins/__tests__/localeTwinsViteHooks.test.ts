import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import { createLocaleTwinsViteHooks } from '../vite/localeTwinsViteHooks';

const CONFIG_DIR = '/app';

function createHooks(enabled = true) {
  return createLocaleTwinsViteHooks({
    enabled,
    localeTwins: {
      missingTranslations: 'warn',
      spaBootstrap: 'inline',
      vendorChunk: true,
      localeCookieName: defaultLocaleCookieName,
    },
    gtConfig: {
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ja'],
      files: { gt: { output: 'src/_gt/[locale].json' } },
    },
    compileTimeHash: true,
    configDir: CONFIG_DIR,
    logLevel: 'silent',
  });
}

function environment(consumer: 'client' | 'server', command = 'build') {
  return {
    name: consumer === 'client' ? 'client' : 'ssr',
    config: {
      root: CONFIG_DIR,
      command,
      consumer,
      build: { outDir: 'dist' },
      logger: { info() {}, warn() {} },
    },
  };
}

function buildStart(
  hooks: ReturnType<typeof createHooks>,
  env: ReturnType<typeof environment>
) {
  const addWatchFile = vi.fn();
  (hooks.buildStart as (this: unknown) => void).call({
    environment: env,
    addWatchFile,
  });
  return addWatchFile;
}

describe('locale twins Vite hooks', () => {
  // SPA client code no longer imports the translation files, so a watch
  // build would keep stale twins after a translation edit
  it("watches every non-default locale's translation file in a client build", () => {
    const addWatchFile = buildStart(createHooks(), environment('client'));

    expect(addWatchFile.mock.calls.map(([file]) => file)).toEqual([
      path.resolve(CONFIG_DIR, 'src/_gt/fr.json'),
      path.resolve(CONFIG_DIR, 'src/_gt/ja.json'),
    ]);
  });

  it('watches nothing in server builds, vite dev, or with locale twins off', () => {
    expect(
      buildStart(createHooks(), environment('server'))
    ).not.toHaveBeenCalled();
    expect(
      buildStart(createHooks(), environment('client', 'serve'))
    ).not.toHaveBeenCalled();
    expect(
      buildStart(createHooks(false), environment('client'))
    ).not.toHaveBeenCalled();
  });
});
