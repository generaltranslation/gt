import { hashSource } from 'generaltranslation/id';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, t } from '../../index';
import { initializeGT, onLocaleChange, setLocale } from '../../standalone';

const key = hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' });
const catalogs: Record<string, Record<string, string>> = {
  de: { [key]: 'Speichern' },
  fr: { [key]: 'Enregistrer' },
};

/** Loads `de` at once and `fr` when the test releases it. */
function createLoader() {
  let started!: () => void;
  let release!: () => void;
  const loading = new Promise<void>((resolve) => (started = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  const loadTranslations = vi.fn(async (locale: string) => {
    if (locale === 'fr') {
      started();
      await released;
    }
    return catalogs[locale] ?? {};
  });
  return { loadTranslations, loading, release };
}

describe('initializeGT', () => {
  let loader: ReturnType<typeof createLoader>;
  const config = () => ({
    defaultLocale: 'en',
    locales: ['en', 'de', 'fr'],
    loadTranslations: loader.loadTranslations,
  });

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    loader = createLoader();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in the default locale and renders the source', async () => {
    await initializeGT(config());

    expect(getLocale()).toBe('en');
    expect(t`Save`).toBe('Save');
  });

  it('loads the starting locale before it resolves and never expires it', async () => {
    vi.useFakeTimers();
    await initializeGT({ ...config(), locale: 'de', cacheExpiryTime: 1 });

    vi.advanceTimersByTime(60_000);

    expect(t`Save`).toBe('Speichern');
  });

  it('switches locale only once its translations have loaded', async () => {
    await initializeGT({ ...config(), locale: 'de' });
    const listener = vi.fn();
    const unsubscribe = onLocaleChange(listener);

    const switching = setLocale('fr');
    await loader.loading;
    expect(t`Save`).toBe('Speichern');
    expect(listener).not.toHaveBeenCalled();

    loader.release();
    await switching;
    expect(t`Save`).toBe('Enregistrer');
    expect(listener).toHaveBeenCalledExactlyOnceWith('fr');

    unsubscribe();
    await setLocale('de');
    expect(getLocale()).toBe('de');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('keeps the latest of two overlapping locale changes', async () => {
    await initializeGT(config());
    const listener = vi.fn();
    onLocaleChange(listener);

    const first = setLocale('fr');
    await setLocale('de');
    loader.release();
    await first;

    expect(getLocale()).toBe('de');
    expect(listener).toHaveBeenCalledExactlyOnceWith('de');
  });
  it('keeps the locale when the next one fails to load, and loads it on a later call', async () => {
    await initializeGT({ ...config(), locale: 'de' });
    const listener = vi.fn();
    onLocaleChange(listener);
    loader.loadTranslations.mockRejectedValueOnce(new Error('offline'));

    await expect(setLocale('fr')).rejects.toThrow('offline');
    expect(t`Save`).toBe('Speichern');
    expect(listener).not.toHaveBeenCalled();

    const retry = setLocale('fr');
    await loader.loading;
    loader.release();
    await retry;
    expect(t`Save`).toBe('Enregistrer');
  });

  it('runs every listener there was when the change began, even after one throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await initializeGT(config());
    const heard: string[] = [];
    onLocaleChange(() => {
      onLocaleChange(() => heard.push('added during the change'));
      throw new Error('menu failed');
    });
    onLocaleChange((locale) => heard.push(locale));

    await setLocale('de');

    expect(getLocale()).toBe('de');
    expect(heard).toEqual(['de']);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('drops a locale change that was still loading when GT was set up again', async () => {
    await initializeGT(config());
    const listener = vi.fn();
    onLocaleChange(listener);
    const stale = setLocale('fr');
    await loader.loading;

    await initializeGT({ ...config(), locale: 'de' });
    loader.release();
    await stale;

    expect(getLocale()).toBe('de');
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the latest change across two copies of the module', async () => {
    await initializeGT(config());
    // As a program that loads both the CommonJS and the ES module build has.
    vi.resetModules();
    const otherCopy = await import('../../standalone');
    expect(otherCopy.setLocale).not.toBe(setLocale);

    const first = setLocale('fr');
    await loader.loading;
    await otherCopy.setLocale('de');
    loader.release();
    await first;

    expect(getLocale()).toBe('de');
  });
  it('starts with source text, and a warning, when the starting locale fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loader.loadTranslations.mockRejectedValueOnce(new Error('offline'));

    await initializeGT({ ...config(), locale: 'de' });

    expect(getLocale()).toBe('de');
    expect(t`Save`).toBe('Save');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();

    // Loading that locale later changes what was rendered, so listeners hear of it, once.
    const rendered: string[] = [];
    onLocaleChange(() => rendered.push(t`Save`));
    await setLocale('de');
    await setLocale('de');
    expect(rendered).toEqual(['Speichern']);
  });
});
