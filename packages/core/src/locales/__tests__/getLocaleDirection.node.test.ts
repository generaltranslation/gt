// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { _getLocaleDirection } from '../getLocaleDirection';
import { intlCache } from '../../cache/IntlCache';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Node.js environment tests for _getLocaleDirection.
 *
 * In Node.js, Intl.Locale supports the textInfo property natively,
 * so direction can be resolved directly without fallback heuristics.
 */
describe.sequential('_getLocaleDirection (node)', () => {
  it('should use Intl.Locale.textInfo direction when available', () => {
    const browserLocale = {
      textInfo: { direction: 'rtl' as const },
      language: 'en',
      maximize: vi.fn(),
    } as unknown as Intl.Locale;

    vi.spyOn(intlCache, 'get').mockReturnValue(browserLocale);

    expect(_getLocaleDirection('en-US')).toBe('rtl');
    expect(browserLocale.maximize).not.toHaveBeenCalled();
  });

  it('should prioritize textInfo direction over script heuristics', () => {
    const browserLocale = {
      textInfo: { direction: 'ltr' as const },
      language: 'ar',
      maximize: vi.fn(() => ({ script: 'Arab' as const })),
    } as unknown as Intl.Locale;

    vi.spyOn(intlCache, 'get').mockReturnValue(browserLocale);

    expect(_getLocaleDirection('ar-Arab')).toBe('ltr');
    expect(browserLocale.maximize).not.toHaveBeenCalled();
  });
});
