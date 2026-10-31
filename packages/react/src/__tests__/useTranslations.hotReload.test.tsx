// @vitest-environment jsdom
import { act, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRuntimeApiUrl } from 'generaltranslation/internal';
import { GTProvider, initializeGT, useTranslations } from '../index.client';

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
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.startsWith(defaultRuntimeApiUrl)) {
          return Response.json({});
        }
        const body =
          input instanceof Request ? await input.text() : String(init?.body);
        const { requests } = JSON.parse(body) as {
          requests: Record<string, unknown>;
        };
        return Response.json(
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
          )
        );
      }
    );
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      devApiKey: 'gtx-dev-test',
      projectId: 'test-project',
    });

    function Group() {
      const t = useTranslations();
      const direct = t.obj('group').title as string;
      const memoized = useMemo(() => t.obj('group').title as string, [t]);
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
