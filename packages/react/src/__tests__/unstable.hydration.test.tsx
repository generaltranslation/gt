// @vitest-environment jsdom
import React, { act, Suspense } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { text } from 'node:stream/consumers';
import { hashSource } from 'generaltranslation/id';
import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import type { Content } from 'generaltranslation/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserGTProvider } from '../provider/BrowserGTProvider';
import { ServerGTProvider } from '../provider/ServerGTProvider';
import { useGT } from '../unstable';

const name = 'Ada';
const helloHash = hashSource({
  source: ['Hello, ', ['name'], '!'],
  dataFormat: 'ICU_TREE',
});
const frenchHello: Content = ['Bonjour, ', ['name'], ' !'];
const config = { defaultLocale: 'en', locales: ['en', 'fr'] };

function resetI18nGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

function FrenchHello() {
  const gt = useGT();
  return <span>{gt({ locale: 'fr' })`Hello, ${{ name }}!`}</span>;
}

const loadFrenchHello = async (locale: string) =>
  locale === 'fr' ? { [helloHash]: frenchHello } : {};

/** Server-renders like streaming SSR: waits for every Suspense boundary. */
function renderToStringWhenReady(element: React.ReactElement) {
  return new Promise<string>((resolve, reject) => {
    const { pipe } = renderToPipeableStream(element, {
      onAllReady: () => resolve(text(pipe(new PassThrough()))),
      onShellError: reject,
    });
  });
}

describe('gt-react/unstable hydration', () => {
  beforeEach(() => {
    resetI18nGlobals();
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetI18nGlobals();
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });

  /** Server-renders, then hydrates a cold client, as framework providers do. */
  async function hydrateFrenchOverride({
    serverConfig,
    clientConfig,
  }: {
    serverConfig: Parameters<typeof internalInitializeGTSRA>[0];
    clientConfig: Parameters<typeof internalInitializeGTSRA>[0];
  }) {
    const page = (
      <Suspense fallback={<i>Loading</i>}>
        <FrenchHello />
      </Suspense>
    );
    internalInitializeGTSRA(serverConfig);
    // Fizz and the client renderer share one context object in this process,
    // so React warns about concurrent renderers; real apps run them apart.
    const serverMarkup = await renderToStringWhenReady(
      <ServerGTProvider locale='en' translations={{}}>
        {page}
      </ServerGTProvider>
    );

    resetI18nGlobals();
    internalInitializeGTSRA(clientConfig);
    const container = document.createElement('div');
    container.innerHTML = serverMarkup;
    const recoverableErrors: unknown[] = [];
    await act(async () => {
      hydrateRoot(
        container,
        <BrowserGTProvider
          locale='en'
          translations={{}}
          _syncConditions={false}
        >
          {page}
        </BrowserGTProvider>,
        { onRecoverableError: (error) => recoverableErrors.push(error) }
      );
    });
    return {
      serverMarkup,
      clientMarkup: container.innerHTML,
      recoverableErrors,
    };
  }

  function stubCdn() {
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => loadFrenchHello(url.endsWith('/fr') ? 'fr' : 'en'),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    return fetchSpy;
  }

  it.each([
    {
      name: 'both sides load from the CDN',
      serverConfig: { ...config, projectId: 'test-project' },
      clientConfig: { ...config, projectId: 'test-project' },
    },
    {
      // Like gt-next with a server-only GT_PROJECT_ID.
      name: 'only the server has a project ID',
      serverConfig: { ...config, projectId: 'test-project' },
      clientConfig: config,
    },
    {
      // Like gt-next: the custom loader runs only on the server.
      name: 'only the server has a custom loader',
      serverConfig: { ...config, loadTranslations: loadFrenchHello },
      clientConfig: { ...config, projectId: 'test-project' },
    },
  ])(
    'renders the source for an override missing from the snapshot when $name',
    async ({ serverConfig, clientConfig }) => {
      const fetchSpy = stubCdn();

      const { serverMarkup, clientMarkup, recoverableErrors } =
        await hydrateFrenchOverride({ serverConfig, clientConfig });

      expect(serverMarkup).toContain('<span>Hello, Ada!</span>');
      expect(clientMarkup).toBe(serverMarkup);
      expect(recoverableErrors).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );
});
