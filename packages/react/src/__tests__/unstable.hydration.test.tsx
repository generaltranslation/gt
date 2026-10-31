// @vitest-environment jsdom
import React, { act, Suspense } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { text } from 'node:stream/consumers';
import { hashMessageTree } from 'generaltranslation/id';
import {
  getReactI18nCache,
  internalInitializeGTSRA,
} from '@generaltranslation/react-core/pure';
import type { Translation } from 'gt-i18n/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserGTProvider } from '../provider/BrowserGTProvider';
import { ServerGTProvider } from '../provider/ServerGTProvider';
import { useGT } from '../unstable';

const name = 'Ada';
const helloHash = hashMessageTree(['Hello, ', ['name'], '!']);
const frenchHello: Translation = ['Bonjour, ', ['name'], ' !'];
const config = { defaultLocale: 'en', locales: ['en', 'fr'] };

function resetI18nGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

function Hello() {
  const gt = useGT();
  return <span>{gt`Hello, ${{ name }}!`}</span>;
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

  it('ignores a warm server cache that the provider snapshot lacks', async () => {
    // Server: the cache has a French tree that was not serialized to the client.
    internalInitializeGTSRA({
      ...config,
      loadTranslations: async () => ({ [helloHash]: frenchHello }),
    });
    await getReactI18nCache().loadTranslations('fr');
    expect(
      getReactI18nCache().lookupTranslationByHash('fr', helloHash)
    ).toEqual(frenchHello);
    const serverMarkup = renderToString(
      <ServerGTProvider locale='fr' translations={{}}>
        <Hello />
      </ServerGTProvider>
    );

    // Client: same props, cold cache.
    resetI18nGlobals();
    internalInitializeGTSRA(config);
    const container = document.createElement('div');
    container.innerHTML = serverMarkup;
    const recoverableErrors: unknown[] = [];
    let firstClientRender = '';
    function Probe() {
      const gt = useGT();
      firstClientRender ||= gt`Hello, ${{ name }}!`;
      return <span>{firstClientRender}</span>;
    }

    await act(async () => {
      hydrateRoot(
        container,
        <BrowserGTProvider
          locale='fr'
          translations={{}}
          _syncConditions={false}
        >
          <Probe />
        </BrowserGTProvider>,
        { onRecoverableError: (error) => recoverableErrors.push(error) }
      );
    });

    expect(serverMarkup).toBe('<span>Hello, Ada!</span>');
    expect(firstClientRender).toBe('Hello, Ada!');
    expect(container.innerHTML).toBe(serverMarkup);
    expect(recoverableErrors).toEqual([]);
  });

  it('suspends an override missing from a provider that never hydrates until it loads', async () => {
    let resolveFrench!: () => void;
    const frenchLoaded = new Promise<void>((resolve) => {
      resolveFrench = resolve;
    });
    internalInitializeGTSRA({
      ...config,
      loadTranslations: async (locale: string) => {
        await frenchLoaded;
        return loadFrenchHello(locale);
      },
    });
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BrowserGTProvider
          locale='en'
          translations={{}}
          _syncConditions={false}
          _canLoadOverrideLocales
        >
          <Suspense fallback={<i>Loading</i>}>
            <FrenchHello />
          </Suspense>
        </BrowserGTProvider>
      );
    });
    expect(container.innerHTML).toBe('<i>Loading</i>');

    await act(async () => {
      resolveFrench();
      // Let the cache load chain settle and ping the suspended render.
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(container.innerHTML).toBe('<span>Bonjour, Ada !</span>');
    act(() => root.unmount());
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
