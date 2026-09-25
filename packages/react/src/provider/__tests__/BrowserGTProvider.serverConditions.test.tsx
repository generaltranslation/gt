// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { useLocale, useSetLocale } from '@generaltranslation/react-core/hooks';
import { BrowserGTProvider } from '../BrowserGTProvider';

// Keep the real provider/context, isolating only translation-cache work.
vi.mock(
  '@generaltranslation/react-core/components',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@generaltranslation/react-core/components')
    >()),
    I18nStore: class {
      updateTranslations() {}
      updateDictionaries() {}
    },
  })
);

function Counter() {
  const [count, setCount] = useState(0);
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <>
      <output>{locale}</output>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <button onClick={() => setLocale('fr')}>French</button>
    </>
  );
}

function resetI18n() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Keep the React context captured by InternalGTProvider at import time.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

describe('server-provided conditions', () => {
  let root: Root;
  let container: HTMLDivElement;
  const reload = vi.fn();

  beforeEach(() => {
    resetI18n();
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
    resetI18n();
    vi.unstubAllGlobals();
  });

  async function render(snapshot: { locale: string; enableI18n: boolean }) {
    await act(async () => {
      root.render(
        <BrowserGTProvider
          locale={snapshot.locale}
          enableI18n={snapshot.enableI18n}
          _reload={reload}
          translations={{}}
          dictionaries={{}}
        >
          <Counter />
        </BrowserGTProvider>
      );
    });
  }

  it('keeps the server locale while pending and after rejection, preserving client state', async () => {
    const snapshot = { locale: 'en', enableI18n: true };
    await render(snapshot);
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(document.cookie).toContain('generaltranslation.locale=fr');
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('output')!.textContent).toBe('en');

    await render(snapshot);
    expect(document.cookie).toContain('generaltranslation.locale=en');
    expect(container.querySelector('output')!.textContent).toBe('en');

    await render({ ...snapshot });
    expect(container.querySelector('output')!.textContent).toBe('en');
    expect(document.cookie).toContain('generaltranslation.locale=en');
    expect(container.querySelector('button')!.textContent).toBe('1');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
    });
  });

  it('renders an accepted locale from the new server snapshot', async () => {
    await render({ locale: 'en', enableI18n: true });
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.querySelector('output')!.textContent).toBe('en');
    await render({ locale: 'fr', enableI18n: true });
    expect(container.querySelector('output')!.textContent).toBe('fr');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
