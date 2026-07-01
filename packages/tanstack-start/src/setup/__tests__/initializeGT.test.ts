import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInitializeGT = vi.hoisted(() => vi.fn());

vi.mock('gt-react', () => ({
  initializeGT: (...args: unknown[]) => mockInitializeGT(...args),
}));

import { initializeGT } from '../initializeGT';

describe('initializeGT warnings', () => {
  beforeEach(() => {
    mockInitializeGT.mockReset();
    vi.restoreAllMocks();
  });

  it('passes through configs without custom cookie names', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

    expect(mockInitializeGT).toHaveBeenCalledWith(config);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and clears custom cookie names', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      defaultLocale: 'en',
      localeCookieName: 'custom-locale',
      regionCookieName: 'custom-region',
      enableI18nCookieName: 'custom-enable-i18n',
    };

    initializeGT(config);

    expect(warnSpy).toHaveBeenCalledWith(
      'gt-tanstack-start Warning: Custom cookie names passed to initializeGT() are temporarily ignored because of a temporary regression. Use the default cookie names until the fix is available. This behavior will be restored in an upcoming patch. Details: localeCookieName, regionCookieName, enableI18nCookieName.'
    );
    expect(mockInitializeGT).toHaveBeenCalledWith({
      ...config,
      localeCookieName: undefined,
      regionCookieName: undefined,
      enableI18nCookieName: undefined,
    });
    expect(config.localeCookieName).toBe('custom-locale');
    expect(config.regionCookieName).toBe('custom-region');
    expect(config.enableI18nCookieName).toBe('custom-enable-i18n');
  });
});
