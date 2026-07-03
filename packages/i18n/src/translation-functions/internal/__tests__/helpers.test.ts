import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveStringContentWithFallback,
  resolveStringContentWithRuntimeFallback,
} from '../helpers';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { getI18nCache } from '../../../i18n-cache/singleton-operations';
import { interpolateMessage } from '../../utils/interpolation/interpolateMessage';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

vi.mock('../../../i18n-cache/singleton-operations');
vi.mock('../../utils/interpolation/interpolateMessage');

describe('translation helpers', () => {
  beforeEach(() => {
    resetGTGlobals();
    vi.clearAllMocks();
    initializeI18nConfig({ defaultLocale: 'en' });
    vi.mocked(interpolateMessage).mockReturnValue('interpolated-result');
  });

  it('resolveStringContentWithRuntimeFallback calls lookupTranslationWithFallback and interpolates', async () => {
    const mockCache = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslationWithFallback: vi
        .fn()
        .mockResolvedValue('Bonjour {name} !'),
    };
    vi.mocked(getI18nCache).mockReturnValue(
      mockCache as unknown as ReturnType<typeof getI18nCache>
    );

    await resolveStringContentWithRuntimeFallback('fr', 'Hello {name}!');

    expect(mockCache.lookupTranslationWithFallback).toHaveBeenCalled();
    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: 'Bonjour {name} !',
      options: expect.objectContaining({ $format: 'STRING', $locale: 'fr' }),
      sourceLocale: 'en',
    });
  });

  it('resolveStringContentWithFallback interpolates source when no translation found', () => {
    const mockCache = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nCache).mockReturnValue(
      mockCache as unknown as ReturnType<typeof getI18nCache>
    );

    resolveStringContentWithFallback('fr', 'Hello {name}!');

    // interpolateMessage is called with target=undefined, causing source fallback
    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: undefined,
      options: expect.objectContaining({ $format: 'STRING', $locale: 'fr' }),
      sourceLocale: 'en',
    });
  });
});
