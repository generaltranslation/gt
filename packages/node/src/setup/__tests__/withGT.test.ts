import { describe, expect, it, beforeEach } from 'vitest';
import { getLocale } from '../../helpers';
import { initializeGT } from '../initializeGT';
import { withGT } from '../withGT';
import { tx } from '../../translation-functions';
import { hashSource } from 'generaltranslation/id';

describe.sequential('withGT', () => {
  beforeEach(() => {
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr', 'es'],
    });
  });

  it('sets the current locale for the callback context', () => {
    const locale = withGT('fr', () => getLocale());

    expect(locale).toBe('fr');
  });

  it('preserves the current locale through async work', async () => {
    const locale = await withGT('es', async () => {
      await Promise.resolve();
      return getLocale();
    });

    expect(locale).toBe('es');
  });

  it('preserves same-language default locale dialects', () => {
    initializeGT({
      defaultLocale: 'pt-BR',
      locales: ['pt', 'fr'],
    });

    const locale = withGT('pt-BR', () => getLocale());

    expect(locale).toBe('pt-BR');
  });

  it('allows explicit runtime locale outside a callback context', async () => {
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr'],
      loadTranslations: () => ({
        [hashSource({ source: 'Hello', dataFormat: 'STRING' })]: 'Bonjour',
      }),
    });

    await expect(tx('Hello', { $locale: 'fr' })).resolves.toBe('Bonjour');
  });
});
