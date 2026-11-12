import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getI18nConfig as getBaseI18nConfig,
  I18nConfig,
  initializeI18nConfig as initializeBaseI18nConfig,
  setI18nConfig as setBaseI18nConfig,
} from 'gt-i18n/internal';
import {
  getI18nConfig as getPureI18nConfig,
  initializeI18nConfig as initializePureI18nConfig,
} from '../../pure';
import {
  getI18nConfig,
  initializeI18nConfig,
  ReactI18nConfig,
} from '../i18nConfig';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('react i18n config', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('stores render strategy on the I18nConfig singleton', () => {
    const config = initializeI18nConfig({ defaultLocale: 'en' }, 'SPA');

    expect(getI18nConfig()).toBe(config);
    expect(getBaseI18nConfig()).toBe(config);
    expect(getI18nConfig().getRenderStrategy()).toBe('SPA');
  });

  it('defaults public pure initialization to server-render', () => {
    const config = initializePureI18nConfig({ defaultLocale: 'en' });

    expect(getPureI18nConfig()).toBe(config);
    expect(getBaseI18nConfig()).toBe(config);
    expect(getPureI18nConfig().getRenderStrategy()).toBe('server-render');
  });

  it('falls back to the default storage names', () => {
    const config = initializeI18nConfig({ defaultLocale: 'en' });

    expect(config.getLocaleCookieName()).toBe('generaltranslation.locale');
    expect(config.getRegionCookieName()).toBe('generaltranslation.region');
    expect(config.getEnableI18nCookieName()).toBe(
      'generaltranslation.enable-i18n'
    );
  });

  it('returns configured custom storage names', () => {
    const config = initializeI18nConfig({
      defaultLocale: 'en',
      localeCookieName: 'custom-locale',
      regionCookieName: 'custom-region',
      enableI18nCookieName: 'custom-enable-i18n',
    });

    expect(config.getLocaleCookieName()).toBe('custom-locale');
    expect(config.getRegionCookieName()).toBe('custom-region');
    expect(config.getEnableI18nCookieName()).toBe('custom-enable-i18n');
  });

  it('rejects invalid runtime render strategy values', () => {
    const initializeWithRuntimeRenderStrategy = initializeI18nConfig as (
      params: Parameters<typeof initializeI18nConfig>[0],
      renderStrategy: unknown
    ) => unknown;

    expect(() =>
      initializeWithRuntimeRenderStrategy({ defaultLocale: 'en' }, 'invalid')
    ).toThrow(/Invalid React render strategy/);
  });

  it('rejects base I18nConfig setup without render strategy support', () => {
    initializeBaseI18nConfig({ defaultLocale: 'en' });

    expect(() => getI18nConfig()).toThrow(
      /Cannot read ReactI18nConfig after base I18nConfig setup/
    );
  });

  it('accepts branded ReactI18nConfig instances from another bundled copy', () => {
    const bundledConfig = new I18nConfig({ defaultLocale: 'en' });
    Object.defineProperty(
      bundledConfig,
      Symbol.for('generaltranslation.react-core.ReactI18nConfig'),
      { value: true }
    );
    Object.defineProperty(bundledConfig, 'getRenderStrategy', {
      value: () => 'SPA',
    });
    Object.defineProperty(bundledConfig, 'getLocaleCookieName', {
      value: () => 'custom-locale',
    });
    Object.defineProperty(bundledConfig, 'getRegionCookieName', {
      value: () => 'custom-region',
    });
    Object.defineProperty(bundledConfig, 'getEnableI18nCookieName', {
      value: () => 'custom-enable-i18n',
    });

    setBaseI18nConfig(bundledConfig);

    expect(getI18nConfig()).toBe(bundledConfig);
    expect(getI18nConfig().getRenderStrategy()).toBe('SPA');
    expect(getI18nConfig().getLocaleCookieName()).toBe('custom-locale');
  });

  // withGTConfig accepts arbitrary keys and the JSON config isn't validated for
  // this field, so a truthy-but-non-true value (e.g. the string "false") must
  // NOT implicitly turn on DOM injection.
  it.each([
    [undefined, false],
    [true, true],
    ['false', false],
    ['true', false],
    [1, false],
    [{}, false],
    [[], false],
  ])('id-tagging for _tagIds=%j is %s', (tagIds, expected) => {
    expect(
      new ReactI18nConfig({
        defaultLocale: 'en',
        _tagIds: tagIds as boolean | undefined,
      }).isIdTaggingEnabled()
    ).toBe(expected);
  });
});
