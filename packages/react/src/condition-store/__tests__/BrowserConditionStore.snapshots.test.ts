// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { createOrUpdateBrowserConditionStore } from '../createBrowserConditionStore';

beforeEach(() => {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr', 'de'] });
});
afterEach(() => {
  for (const cookie of document.cookie.split(';')) {
    document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
  }
  Reflect.deleteProperty(globalThis, '__generaltranslation');
});

it('reads locale and region from the server snapshot instead of changed cookies', () => {
  document.cookie = 'generaltranslation.locale=fr;path=/';
  document.cookie = 'generaltranslation.region=CA;path=/';
  const store = createOrUpdateBrowserConditionStore({
    _serverConditions: { locale: 'en', region: 'GB' },
  });
  expect(store.getLocale()).toBe('en');
  expect(store.getRegion()).toBe('GB');
  document.cookie = 'generaltranslation.locale=de;path=/';
  document.cookie = 'generaltranslation.region=US;path=/';
  expect(store.getLocale()).toBe('en');
  expect(store.getRegion()).toBe('GB');
  expect(
    createOrUpdateBrowserConditionStore({
      _serverConditions: { locale: 'en' },
    }).getRegion()
  ).toBeUndefined();
});

it('uses pending conditions only for reload, including an explicitly cleared region', () => {
  const reload = vi.fn();
  const store = createOrUpdateBrowserConditionStore({
    _serverConditions: { locale: 'en', region: 'US' },
    _reload: reload,
  });
  store.setLocale('fr');
  expect(store.getLocale()).toBe('en');
  expect(document.cookie).toContain('generaltranslation.locale=fr');
  expect(document.cookie).toContain('generaltranslation.locale-reset=true');
  expect(reload).toHaveBeenLastCalledWith({
    locale: 'fr',
    region: 'US',
    enableI18n: true,
  });
  store.setRegion(undefined);
  expect(store.getRegion()).toBe('US');
  expect(reload).toHaveBeenLastCalledWith({
    locale: 'fr',
    region: undefined,
    enableI18n: true,
  });
});

it('starts a new server snapshot without the previous pending request', () => {
  const reload = vi.fn();
  const current = createOrUpdateBrowserConditionStore({
    _serverConditions: { locale: 'en' },
    _reload: reload,
  });
  current.setLocale('fr');
  current.reload();
  expect(reload).toHaveBeenLastCalledWith({
    locale: 'fr',
    region: undefined,
    enableI18n: true,
  });

  const response = createOrUpdateBrowserConditionStore({
    _serverConditions: { locale: 'en' },
    _reload: reload,
  });
  expect(response.getLocale()).toBe('en');
  response.reload();
  expect(reload).toHaveBeenLastCalledWith({
    locale: 'en',
    region: undefined,
    enableI18n: true,
  });
});
