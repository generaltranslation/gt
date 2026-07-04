import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import { initializeGT } from '../initializeGT';

describe('initializeGT', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes the i18n config and cache for translation snapshots', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loadTranslations = vi.fn(async () => ({
      greeting: 'Hola',
    }));

    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'es'],
      loadTranslations,
    });

    await expect(getTranslationsSnapshot('es')).resolves.toEqual({
      es: { greeting: 'Hola' },
    });
    expect(loadTranslations).toHaveBeenCalledWith('es');
  });
});
