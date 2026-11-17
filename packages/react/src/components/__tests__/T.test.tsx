// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T } from '@generaltranslation/react-core/components';
import { useGT } from '@generaltranslation/react-core/hooks';
import {
  I18nStore,
  initializeI18nConfig,
  setI18nStore,
  setReactI18nCache,
  type ReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { createOrUpdateBrowserConditionStore } from '../../condition-store/createBrowserConditionStore';

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
}

describe('a client-rendered app without a provider', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setReactI18nCache({
      lookupTranslation: () => 'Bonjour',
    } as unknown as ReactI18nCache);
    createOrUpdateBrowserConditionStore({ locale: 'fr', _reload: () => {} });
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    resetGTGlobals();
    vi.unstubAllGlobals();
  });

  it('subscribes a <T> once while its props stay the same', async () => {
    const i18nStore = new I18nStore();
    const subscribe = vi.spyOn(i18nStore, 'subscribeToTranslate');
    setI18nStore(i18nStore);
    let rerender!: () => void;

    function App() {
      const [count, setCount] = useState(0);
      rerender = () => setCount(count + 1);
      return (
        <p data-count={count}>
          <T context='greeting'>Hello</T>
        </p>
      );
    }

    await act(async () => root.render(<App />));
    await act(async () => rerender());
    await act(async () => rerender());

    expect(container.innerHTML).toBe('<p data-count="2">Bonjour</p>');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps the function from useGT() between renders', async () => {
    setI18nStore(new I18nStore());
    const functions = new Set<unknown>();
    let rerender!: () => void;

    function App() {
      const [count, setCount] = useState(0);
      rerender = () => setCount(count + 1);
      functions.add(useGT());
      return count;
    }

    await act(async () => root.render(<App />));
    await act(async () => rerender());

    expect(container.innerHTML).toBe('1');
    expect(functions.size).toBe(1);
  });
});
