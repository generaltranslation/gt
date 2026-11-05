import { describe, expect, it } from 'vitest';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { resolveLocaleTwinsSettings } from '../config';
import { unplugin } from '../index';

const twinsConfig = { experimental: { splitting: 'locale-twins' as const } };

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

  it('reads experimental.splitting from gt.config.json', () => {
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
        gtConfig: { experimental: { splitting: 'locale' } },
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

  it('throws a diagnostic for an unknown experimental.splitting value', () => {
    expect(() =>
      resolveLocaleTwinsSettings({
        gtConfig: { experimental: { splitting: 'module' as 'locale' } },
      })
    ).toThrow(/experimental\.splitting.*"module"/);
  });
});

describe('plugin creation', () => {
  it('rejects an unknown splitting option when the plugin is created', () => {
    expect(() =>
      unplugin.raw(
        { gtConfig: {}, splitting: 'module' as 'locale', logLevel: 'silent' },
        { framework: 'vite' }
      )
    ).toThrow(/@generaltranslation\/compiler Error/);
  });
});
