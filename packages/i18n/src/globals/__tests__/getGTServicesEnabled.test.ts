import { afterEach, describe, expect, it } from 'vitest';
import { getGTServicesEnabled } from '../getGTServicesEnabled';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: Record<string, unknown>;
};

describe('getGTServicesEnabled', () => {
  afterEach(() => {
    (globalThis as TestGlobal).__generaltranslation = undefined;
  });

  it('stores true when GT remote translations are enabled', () => {
    initializeI18nConfig({ projectId: 'test-project' });

    expect(getGTServicesEnabled()).toBe(true);
  });

  it('stores true when the GT runtime API is enabled', () => {
    initializeI18nConfig({
      projectId: 'test-project',
      devApiKey: 'test-key',
      cacheUrl: null,
    });

    expect(getGTServicesEnabled()).toBe(true);
  });

  it('stores false when GT services are disabled', () => {
    initializeI18nConfig({
      cacheUrl: null,
      runtimeUrl: null,
    });

    expect(getGTServicesEnabled()).toBe(false);
  });

  it('returns false before config is initialized', () => {
    expect(getGTServicesEnabled()).toBe(false);
  });
});
