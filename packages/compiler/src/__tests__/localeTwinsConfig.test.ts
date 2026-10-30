import { describe, expect, it } from 'vitest';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { resolveLocaleTwinsSettings } from '../config';
import gtUnplugin from '../index';
import { initializeState } from '../state/utils/initializeState';

const twinsConfig = { files: { gt: { splitting: 'locale-twins' as const } } };

describe('resolveLocaleTwinsSettings', () => {
  it('defaults to locale splitting with default locale twin options', () => {
    expect(resolveLocaleTwinsSettings({})).toEqual({
      splitting: 'locale',
      localeTwins: {
        missingTranslations: 'warn',
        spaBootstrap: 'inline',
        vendorChunk: true,
        localeCookieName: defaultLocaleCookieName,
        enableI18nCookieName: defaultEnableI18nCookieName,
      },
    });
  });

  it('reads files.gt.splitting from gt.config.json', () => {
    expect(
      resolveLocaleTwinsSettings({ gtConfig: twinsConfig }).splitting
    ).toBe('locale-twins');
  });

  it('lets the plugin option override gt.config.json', () => {
    expect(
      resolveLocaleTwinsSettings({ gtConfig: twinsConfig, splitting: 'locale' })
        .splitting
    ).toBe('locale');
    expect(
      resolveLocaleTwinsSettings({
        gtConfig: { files: { gt: { splitting: 'locale' } } },
        splitting: 'locale-twins',
      }).splitting
    ).toBe('locale-twins');
  });

  it('merges partial localeTwins options over the defaults', () => {
    expect(
      resolveLocaleTwinsSettings({
        localeTwins: { missingTranslations: 'error', vendorChunk: false },
      }).localeTwins
    ).toEqual({
      missingTranslations: 'error',
      spaBootstrap: 'inline',
      vendorChunk: false,
      localeCookieName: defaultLocaleCookieName,
      enableI18nCookieName: defaultEnableI18nCookieName,
    });
  });

  it('throws a compiler diagnostic for an unknown splitting option', () => {
    expect(() =>
      resolveLocaleTwinsSettings({ splitting: 'module' as 'locale' })
    ).toThrow(
      /^@generaltranslation\/compiler Error: .*splitting.*"module".*locale-twins/
    );
  });

  it('throws a diagnostic for an unknown files.gt.splitting value', () => {
    expect(() =>
      resolveLocaleTwinsSettings({
        gtConfig: { files: { gt: { splitting: 'module' as 'locale' } } },
      })
    ).toThrow(/files\.gt\.splitting.*"module"/);
  });
});

describe('plugin creation', () => {
  it('rejects an unknown splitting option when the plugin is created', () => {
    expect(() =>
      gtUnplugin.raw(
        { gtConfig: {}, splitting: 'module' as 'locale', logLevel: 'silent' },
        { framework: 'vite' }
      )
    ).toThrow(/@generaltranslation\/compiler Error/);
  });
});

describe('initializeState locale twins settings', () => {
  it('exposes the resolved strategy and options on the per-file settings', () => {
    const { settings } = initializeState(
      { gtConfig: twinsConfig, localeTwins: { spaBootstrap: 'external' } },
      'src/App.tsx'
    );
    expect(settings.splitting).toBe('locale-twins');
    expect(settings.localeTwins).toEqual({
      missingTranslations: 'warn',
      spaBootstrap: 'external',
      vendorChunk: true,
      localeCookieName: defaultLocaleCookieName,
      enableI18nCookieName: defaultEnableI18nCookieName,
    });
  });

  it("keeps today's behaviour when nothing is configured", () => {
    const { settings } = initializeState({}, 'src/App.tsx');
    expect(settings.splitting).toBe('locale');
  });
});
