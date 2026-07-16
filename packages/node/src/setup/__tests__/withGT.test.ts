import { describe, expect, it, beforeEach } from 'vitest';
import { getLocale } from 'gt-i18n';
import { initializeGT } from '../initializeGT';
import { withGT } from '../withGT';
import { tx } from 'gt-i18n/internal';
import { hashSource } from 'generaltranslation/id';
import { getAsyncConditionStore } from '../../async-i18n-cache/singleton-operations';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe.sequential('withGT', () => {
  beforeEach(() => {
    resetGTGlobals();
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

  it('provides scoped region and i18n conditions', () => {
    const conditions = withGT(
      { locale: 'fr', region: 'CA', enableI18n: false },
      () => {
        const store = getAsyncConditionStore();
        return {
          locale: store.getLocale(),
          region: store.getRegion(),
          enableI18n: store.getEnableI18n(),
        };
      }
    );

    expect(conditions).toEqual({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
    });
  });

  it('preserves same-language default locale dialects', () => {
    resetGTGlobals();
    initializeGT({
      defaultLocale: 'pt-BR',
      locales: ['pt', 'fr'],
    });

    const locale = withGT('pt-BR', () => getLocale());

    expect(locale).toBe('pt-BR');
  });

  it('allows explicit runtime locale to override the callback context', async () => {
    resetGTGlobals();
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr'],
      loadTranslations: () => ({
        [hashSource({ source: 'Hello', dataFormat: 'STRING' })]: 'Bonjour',
      }),
    });

    await expect(
      withGT('en-US', () => tx('Hello', { $locale: 'fr' }))
    ).resolves.toBe('Bonjour');
  });

  it('returns source content when i18n is disabled for the scope', async () => {
    resetGTGlobals();
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr'],
      loadTranslations: () => ({
        [hashSource({ source: 'Hello', dataFormat: 'STRING' })]: 'Bonjour',
      }),
    });

    await expect(
      withGT({ locale: 'fr', enableI18n: false }, () => tx('Hello'))
    ).resolves.toBe('Hello');
  });
});
