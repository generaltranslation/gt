// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { _getLocaleDirection } from '../getLocaleDirection';
import { intlCache } from '../../cache/IntlCache';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mocks intlCache.get so that 'Locale' calls return a real Intl.Locale
 * with textInfo stripped, simulating browser environments where the
 * textInfo property is not supported. All other calls (DisplayNames, etc.)
 * pass through to the real implementation.
 *
 * Note: jsdom/happy-dom inherit Node's Intl implementation, so textInfo
 * must be manually stripped even when using a browser-like vitest environment.
 */
function mockLocaleWithoutTextInfo() {
  const originalGet = intlCache.get.bind(intlCache);
  vi.spyOn(intlCache, 'get').mockImplementation(
    (...args: Parameters<typeof intlCache.get>) => {
      if (args[0] === 'Locale') {
        const locale = new Intl.Locale(args[1] as string);
        Object.defineProperty(locale, 'textInfo', {
          value: undefined,
          configurable: true,
        });
        return locale as ReturnType<typeof intlCache.get>;
      }
      return originalGet(...args);
    }
  );
}

/**
 * Browser environment tests for _getLocaleDirection.
 *
 * Simulates browsers where Intl.Locale does not expose the textInfo
 * property, forcing the function to fall back to script and language
 * heuristics via _getLocaleProperties.
 */
describe.sequential('_getLocaleDirection (browser)', () => {
  it('should detect rtl script when Intl.Locale lacks textInfo support', () => {
    mockLocaleWithoutTextInfo();
    expect(_getLocaleDirection('az-Arab')).toBe('rtl');
  });

  it('should detect ltr script when Intl.Locale lacks textInfo support', () => {
    mockLocaleWithoutTextInfo();
    expect(_getLocaleDirection('az-Latn')).toBe('ltr');
  });

  it('should fall back to known rtl languages when Intl.Locale is not available', () => {
    vi.spyOn(intlCache, 'get').mockImplementation(() => {
      throw new Error('Intl.Locale not supported');
    });

    expect(_getLocaleDirection('ar')).toBe('rtl');
  });

  it('should fall back to ltr for unknown languages when Intl.Locale is not available', () => {
    vi.spyOn(intlCache, 'get').mockImplementation(() => {
      throw new Error('Intl.Locale not supported');
    });

    expect(_getLocaleDirection('en')).toBe('ltr');
  });
});
