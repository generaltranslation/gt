// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { BrowserGTProvider } from '../BrowserGTProvider';
import { getBrowserConditionStore } from '../../condition-store/singleton-operations';

// Isolate condition reconciliation from the translation cache.
vi.mock('@generaltranslation/react-core/components', () => ({
  I18nStore: class {},
  InternalGTProvider: ({ children }: { children?: React.ReactNode }) =>
    children,
}));

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

describe('App Router server condition snapshots', () => {
  let root: Root;
  let container: HTMLDivElement;
  const reload = vi.fn();

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    container = document.createElement('div');
    root = createRoot(container);
    reload.mockClear();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.unstubAllGlobals();
  });

  async function render(snapshot?: { locale: string; enableI18n: boolean }) {
    await act(async () => {
      root.render(
        <BrowserGTProvider
          locale={snapshot?.locale ?? 'en'}
          enableI18n={snapshot?.enableI18n ?? true}
          _serverConditions={snapshot}
          _reload={reload}
          translations={{}}
          dictionaries={{}}
        >
          <Counter />
        </BrowserGTProvider>
      );
    });
  }

  it('reconciles a rejected locale switch only on a fresh snapshot, preserving client state', async () => {
    const snapshot = { locale: 'en', enableI18n: true };
    await render(snapshot);
    const store = getBrowserConditionStore();
    await act(async () => container.querySelector('button')!.click());
    store.setLocale('fr');
    expect(store.getLocale()).toBe('fr');

    await render(snapshot);
    expect(store.getLocale()).toBe('fr');

    await render({ ...snapshot });
    expect(getBrowserConditionStore()).toBe(store);
    expect(store.getLocale()).toBe('en');
    expect(container.textContent).toBe('1');
    // Synchronizing a server result must not initiate another refresh.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('accepts a successful locale switch from the server', async () => {
    await render({ locale: 'en', enableI18n: true });
    const store = getBrowserConditionStore();
    store.setLocale('fr');
    await render({ locale: 'fr', enableI18n: true });
    expect(store.getLocale()).toBe('fr');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing memo behavior without an App Router snapshot', async () => {
    await render();
    const store = getBrowserConditionStore();
    store.setLocale('fr');
    store.setEnableI18n(false);
    await render();
    expect(store.getLocale()).toBe('fr');
    expect(store.getEnableI18n()).toBe(false);
  });

  it('preserves disabled i18n when the server returns the persisted choice', async () => {
    await render({ locale: 'en', enableI18n: true });
    const store = getBrowserConditionStore();
    store.setEnableI18n(false);
    await render({ locale: 'en', enableI18n: false });
    expect(store.getEnableI18n()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
