import { describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

// The barrel file re-exports GTProvider, which imports real react-native
// components. react-native's own entrypoint uses Flow syntax vitest/Vite
// can't parse, so it must be mocked before importing '../index' at all —
// same approach as NativeGtReactNative.test.ts.
const reactNative = vi.hoisted(() => ({ loaded: false }));
vi.mock('react-native', () => {
  reactNative.loaded = true;
  return {
    Platform: { OS: 'ios' },
    TurboModuleRegistry: { getEnforcing: vi.fn(), get: vi.fn() },
    ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { create: (styles: unknown) => styles },
    View: 'View',
  };
});

// First, while react-native has not been loaded by another test.
describe('gt-react-native/testing', () => {
  it('renders source text without loading react-native or any setup', async () => {
    const testing = await import('../testing');
    const t = await testing.getGT();

    expect(t`Hello, ${{ name: 'Ada' }}!`).toBe('Hello, Ada!');
    expect(testing.getLocale()).toBe('en');
    expect(reactNative.loaded).toBe(false);
  });

  it('exports every name the main entry exports', async () => {
    const testing = await import('../testing');
    const main = await import('../index');

    expect(Object.keys(testing).sort()).toEqual(Object.keys(main).sort());
  });
});

describe('gt-react-native package exports', () => {
  it('exports getLocaleProperties, matching the gt-react entrypoint', async () => {
    initializeI18nConfig(
      {
        defaultLocale: 'en-US',
        locales: ['en-US', 'de-AT'],
      },
      'server-render'
    );

    const { getLocaleProperties } = await import('../index');
    const properties = getLocaleProperties('de-AT');

    expect(properties.code).toBe('de-AT');
    expect(properties.languageCode).toBe('de');
    expect(properties.regionCode).toBe('AT');
  });

  it('matches the gt-react client entry apart from platform-specific exports', async () => {
    const reactOnly = [
      // Client-rendered (SPA) only: they read a global locale store, which
      // React Native does not register.
      't',
      'm',
      'initializeGTSPA',
      'createOrUpdateBrowserConditionStore',
      // DOM UI and browser request parsing.
      'LocaleSelector',
      'RegionSelector',
      'parseLocale',
      // Server-rendered and compiler-injected.
      'Tx',
      'GtInternalTranslateJsx',
      'GtInternalVar',
      'GtInternalRuntimeTranslateJsx',
    ];
    const reactNativeOnly = [
      'getLocale',
      'getLocaleFromNativeStore',
      'getNativeLocales',
    ];

    const reactNative = await import('../index');
    const react = await import('../../../react/src/index.client');

    expect(
      Object.keys(reactNative)
        .filter((name) => !reactNativeOnly.includes(name))
        .sort()
    ).toEqual(
      Object.keys(react)
        .filter((name) => !reactOnly.includes(name))
        .sort()
    );
    for (const name of ['useGT', 'useMessages', 'msg', 'derive'] as const) {
      expect(reactNative[name]).toBe(react[name]);
    }
  });
});
