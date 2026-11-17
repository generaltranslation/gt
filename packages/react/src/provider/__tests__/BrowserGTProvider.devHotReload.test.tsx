// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import { GTProvider, useGT } from '../../index.client';

type TestGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('BrowserGTProvider dev hot reload', () => {
  let root: Root;
  let element: HTMLDivElement;

  beforeEach(() => {
    (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = true;
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    Reflect.deleteProperty(
      Reflect.get(globalThis, '__generaltranslation'),
      'i18n'
    );
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function renderGreeting(cacheExpiryTime: number | null) {
    vi.stubEnv('NODE_ENV', 'development');
    // jsdom's AbortSignal cannot reach Node's Request, so stub the runtime
    // rather than fetch.
    const translateMany = vi
      .spyOn(GTRuntime.prototype, 'translateMany')
      .mockImplementation((async (requests: Record<string, unknown>) =>
        Object.fromEntries(
          Object.keys(requests).map((hash) => [
            hash,
            {
              success: true,
              translation: 'Bonjour',
              locale: 'fr',
              dataFormat: 'MESSAGE_TREE',
            },
          ])
        )) as never);
    // The browser initializeGT() ignores cacheExpiryTime.
    internalInitializeGTSRA({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      apiKey: 'gtx-dev-test',
      projectId: 'test-project',
      cacheExpiryTime,
      loadTranslations: async () => ({}),
    });

    function Greeting() {
      const t = useGT();
      return <span>{t`Hello`}</span>;
    }

    act(() => {
      root.render(
        <GTProvider locale='fr' translations={{ fr: {} }}>
          <Greeting />
        </GTProvider>
      );
    });
    return translateMany;
  }

  it('renders a translation when it arrives', async () => {
    renderGreeting(null);

    await vi.waitFor(() => expect(element.textContent).toBe('Bonjour'));
  });

  it('requests a translation once when the cache cannot keep it', async () => {
    const translateMany = renderGreeting(0);

    await vi.waitFor(() => expect(translateMany).toHaveBeenCalled());
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(element.textContent).toBe('Hello');
  });
});
