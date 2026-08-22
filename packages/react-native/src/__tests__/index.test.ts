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
});
