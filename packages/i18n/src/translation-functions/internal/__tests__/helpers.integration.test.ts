import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nManager } from '../../../i18n-manager/I18nManager';
import { setI18nManager } from '../../../i18n-manager/singleton-operations';
import { hashMessage } from '../../../utils/hashMessage';
import { LookupOptions } from '../../types/options';
import {
  resolveStringContentWithRuntimeFallback,
  resolveJsxWithRuntimeFallback,
} from '../helpers';

// Mock createTranslateManyFactory to inject controlled translateMany
const mockTranslateMany = vi.fn();
vi.mock(
  '../../../i18n-manager/translations-manager/utils/createTranslateMany',
  () => ({
    createTranslateManyFactory: vi
      .fn()
      .mockReturnValue(() => mockTranslateMany),
  })
);

describe('translation helpers (deep integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupManager(preloadedTranslations: Record<string, string> = {}) {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue(preloadedTranslations),
    });
    manager.setLocale('fr');
    setI18nManager(manager);
    return manager;
  }

  it('resolveStringContentWithRuntimeFallback triggers translateMany when translation not preloaded', async () => {
    const message = 'Good morning';
    const options: LookupOptions = { $format: 'ICU' };
    const hash = hashMessage(message, options);

    // No preloaded translations — will miss cache and fall back to runtime
    setupManager({});

    mockTranslateMany.mockResolvedValue({
      [hash]: { success: true, translation: 'Bonjour' },
    });

    const promise = resolveStringContentWithRuntimeFallback(message, {
      $format: 'ICU',
    });

    // Flush batch timer so translateMany fires
    await vi.advanceTimersByTimeAsync(50);

    const result = await promise;

    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
    // The sources arg should contain our message keyed by hash
    const sourcesArg = mockTranslateMany.mock.calls[0][0];
    expect(sourcesArg[hash]).toBeDefined();
    expect(sourcesArg[hash].source).toBe('Good morning');

    // Result should be the translated + interpolated string
    expect(typeof result).toBe('string');
  });

  it('resolveStringContentWithRuntimeFallback returns preloaded translation without calling translateMany', async () => {
    const message = 'Hello';
    const options: LookupOptions = { $format: 'ICU' };
    const hash = hashMessage(message, options);

    // Preload the translation
    setupManager({ [hash]: 'Bonjour' });

    const result = await resolveStringContentWithRuntimeFallback(message, {
      $format: 'ICU',
    });

    // translateMany should NOT be called because the translation was preloaded
    expect(mockTranslateMany).not.toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });

  it('resolveJsxWithRuntimeFallback triggers translateMany for missing JSX translation', async () => {
    const content = ['Hello ', 'world'];
    const options: LookupOptions = { $format: 'JSX' };
    const hash = hashMessage(content, options);

    setupManager({});

    const translatedContent = ['Bonjour ', 'le monde'];
    mockTranslateMany.mockResolvedValue({
      [hash]: { success: true, translation: translatedContent },
    });

    const promise = resolveJsxWithRuntimeFallback(content, {});

    await vi.advanceTimersByTimeAsync(50);

    const result = await promise;

    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(translatedContent);
  });

  it('resolveStringContentWithRuntimeFallback falls back to source when translateMany fails', async () => {
    const message = 'Fallback test';
    const options: LookupOptions = { $format: 'STRING' };
    const hash = hashMessage(message, options);

    setupManager({});

    mockTranslateMany.mockResolvedValue({
      [hash]: { success: false, error: 'Translation failed' },
    });

    const promise = resolveStringContentWithRuntimeFallback(message, {
      $format: 'STRING',
    });

    await vi.advanceTimersByTimeAsync(50);

    // The runtime fallback rejects, lookupTranslationWithFallback
    // catches the error and returns undefined, helper falls back to source
    const result = await promise;
    expect(result).toBe('Fallback test');
  });
});
