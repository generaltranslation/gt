// @vitest-environment jsdom
import { act, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { initializeGT } from '../../index.client';
import { GTProvider, useTranslations } from '../../compat.client';

type TestGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('useTranslations dev hot reload', () => {
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('updates memoized dictionary objects when a translation arrives', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    // jsdom's AbortSignal cannot reach Node's Request, so stub the runtime
    // rather than fetch.
    vi.spyOn(GTRuntime.prototype, 'translateMany').mockImplementation((async (
      requests: Record<string, unknown>
    ) =>
      Object.fromEntries(
        Object.keys(requests).map((hash) => [
          hash,
          {
            success: true,
            translation: 'Bonjour',
            locale: 'fr',
            dataFormat: 'ICU',
          },
        ])
      )) as never);
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      devApiKey: 'gtx-dev-test',
      projectId: 'test-project',
    });

    function Group() {
      const t = useTranslations();
      const title = () => (t.obj('group') as { title: string }).title;
      const direct = title();
      const memoized = useMemo(() => title(), [t]);
      return <span>{`${direct}|${memoized}`}</span>;
    }

    await act(async () => {
      root.render(
        <GTProvider
          locale='fr'
          translations={{ fr: {} }}
          dictionaries={{ en: { group: { title: 'Hello' } } }}
        >
          <Group />
        </GTProvider>
      );
    });
    await vi.waitFor(
      () => expect(element.textContent).toBe('Bonjour|Bonjour'),
      { timeout: 2000 }
    );
  });
});
