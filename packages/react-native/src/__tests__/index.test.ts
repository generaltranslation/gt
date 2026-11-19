import { describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

// The barrel file re-exports GTProvider, which imports real react-native
// components. react-native's own entrypoint uses Flow syntax vitest/Vite
// can't parse, so it must be mocked before importing '../index' at all —
// same approach as NativeGtReactNative.test.ts.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  TurboModuleRegistry: { getEnforcing: vi.fn(), get: vi.fn() },
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

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
    const reactNativeOnly = ['getLocale', 'getLocaleFromNativeStore'];

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
