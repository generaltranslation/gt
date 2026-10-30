import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocaleFromPath, getPathnameForLocale } from '../localeRouting';

describe.sequential('locale routing', () => {
  beforeAll(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the TanStack Router basepath', () => {
    vi.stubEnv('TSS_ROUTER_BASEPATH', 'app');

    expect(getLocaleFromPath('/app/fr/about')).toBe('fr');
    expect(
      getPathnameForLocale({ pathname: '/app/fr/about', locale: 'ar' })
    ).toBe('/app/ar/about');
  });
});
