import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveJsx,
  resolveStringContentWithFallback,
  resolveStringContentWithRuntimeFallback,
} from '../helpers';
import { getI18nManager } from '../../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../../utils/interpolation/interpolateMessage';

vi.mock('../../../i18n-manager/singleton-operations');
vi.mock('../../utils/interpolation/interpolateMessage');

describe('translation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interpolateMessage).mockReturnValue('interpolated-result');
  });

  // ===== REGRESSION ===== //

  it('resolveJsx returns undefined when lookupTranslation returns undefined', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    const result = resolveJsx('fr', ['Hello']);
    expect(result).toBeUndefined();
  });

  it('resolveJsx uses the provided locale', () => {
    const mockManager = {
      lookupTranslation: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    resolveJsx('fr', ['Hello']);

    expect(mockManager.lookupTranslation).toHaveBeenCalledWith(
      'fr',
      ['Hello'],
      expect.objectContaining({ $format: 'JSX', $locale: 'fr' })
    );
  });

  // ===== NEW BEHAVIOR ===== //

  it('resolveStringContentWithRuntimeFallback calls lookupTranslationWithFallback and interpolates', async () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslationWithFallback: vi
        .fn()
        .mockResolvedValue('Bonjour {name} !'),
      getDefaultLocale: vi.fn().mockReturnValue('en'),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    await resolveStringContentWithRuntimeFallback('fr', 'Hello {name}!');

    expect(mockManager.lookupTranslationWithFallback).toHaveBeenCalled();
    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: 'Bonjour {name} !',
      options: expect.objectContaining({ $format: 'STRING', $locale: 'fr' }),
      sourceLocale: 'en',
    });
  });

  it('resolveStringContentWithFallback interpolates source when no translation found', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue(undefined),
      getDefaultLocale: vi.fn().mockReturnValue('en'),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
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
