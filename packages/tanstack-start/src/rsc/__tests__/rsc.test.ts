import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureInitialized, rsc } = vi.hoisted(() => {
  const render = (name: string, marker: object) =>
    Object.assign(
      vi.fn((props: object) => ({ name, props })),
      { _gtt: marker }
    );
  const variable = (variableType: string) => ({
    kind: 'variable',
    variableType,
  });
  return {
    ensureInitialized: vi.fn(),
    rsc: {
      Currency: render('Currency', variable('c')),
      DateTime: render('DateTime', variable('d')),
      N: render('N', variable('n')),
      Num: render('Num', variable('n')),
      Ordinal: render('Ordinal', { kind: 'ordinal' }),
      Plural: render('Plural', { kind: 'plural' }),
      RelativeTime: render('RelativeTime', variable('rt')),
      T: render('T', { kind: 'translate' }),
    },
  };
});

vi.mock('@generaltranslation/react-core/components-rsc', async () => ({
  ...(await vi.importActual<object>(
    '@generaltranslation/react-core/components-rsc'
  )),
  ...rsc,
}));
vi.mock('@generaltranslation/react-core/pure', () => ({
  getFormatLocales: (conditions: object) => [conditions],
}));
vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getI18nConfig: () => {
    // As gt-i18n does before GT is set up
    if (!ensureInitialized.mock.calls.length) throw new Error('No config');
    return {
      getLocales: () => ['en', 'fr'],
      getDefaultLocale: () => 'en',
      getCustomMapping: () => ({ fr: 'Français' }),
    };
  },
}));
vi.mock('gt-tanstack-start/internal/initializeGT.server', () => ({
  ensureInitialized,
  getServerConditionStore: () => ({
    getLocale: () => 'fr',
    getEnableI18n: () => true,
  }),
}));
vi.mock('../../functions/runtime.server', () => ({
  getEnableI18n: () => true,
  getGT: async () => 'gt',
  getLocale: () => 'fr',
  getMessages: async () => 'm',
}));

const components = await import('../components');
const hooks = await import('../hooks');
const { setupRouterGTIntegration } =
  await import('../setupRouterGTIntegration');
const { findClientReferenceChunks } = await import('../clientReferenceChunks');

const CLIENT_CHUNKS = Symbol.for('tanstack.rsc.jsPreloads');

/** A server component as TanStack Start keeps it in loader data. */
const createServerComponent = (chunks: unknown) =>
  new Proxy(
    {},
    {
      // It answers any property, as the framework's does
      has: () => true,
      get: (_target, property) =>
        property === CLIENT_CHUNKS ? chunks : createServerComponent(chunks),
    }
  );

describe('the react-server entry', () => {
  beforeEach(() => {
    ensureInitialized.mockClear();
  });

  it.each([
    ['T', 'T', { kind: 'translate' }],
    ['GtInternalTranslateJsx', 'T', { kind: 'translate', automatic: true }],
    ['N', 'N', rsc.N._gtt],
    ['Num', 'Num', rsc.Num._gtt],
    ['Currency', 'Currency', rsc.Currency._gtt],
    ['DateTime', 'DateTime', rsc.DateTime._gtt],
    ['RelativeTime', 'RelativeTime', rsc.RelativeTime._gtt],
    ['Plural', 'Plural', { kind: 'plural' }],
    ['Ordinal', 'Ordinal', { kind: 'ordinal' }],
  ] as const)(
    "gives %s the request's locale, which a server component has no context for",
    (name, rendered, marker) => {
      const Component = components[name] as unknown as {
        (props: object): unknown;
        _gtt: object;
      };

      expect(Component({ children: 'Save', id: 'save' })).toEqual({
        name: rendered,
        props: {
          children: 'Save',
          id: 'save',
          _locale: 'fr',
          _enableI18n: true,
        },
      });
      // What the `<T>` around it reads
      expect(Component._gtt).toEqual(marker);
    }
  );

  it("reads the request's locale and state in its hooks", () => {
    expect(hooks.useLocale()).toBe('fr');
    expect(hooks.useEnableI18n()).toBe(true);
    expect(hooks.useFormatLocales()).toEqual([
      { locale: 'fr', enableI18n: true },
    ]);
  });

  it.each([
    ['useLocales', ['en', 'fr']],
    ['useDefaultLocale', 'en'],
    ['useCustomMapping', { fr: 'Français' }],
  ] as const)(
    'sets GT up before %s reads the config, as no router has in a server function',
    (name, expected) => {
      expect(hooks[name]()).toEqual(expected);
      expect(ensureInitialized).toHaveBeenCalledOnce();
    }
  );

  it.each(['useSetLocale', 'useSetEnableI18n'] as const)(
    'fails when a server component calls %s, and says where to call it',
    (name) => {
      expect(() => hooks[name]()).toThrow(
        `gt-tanstack-start Error: ${name}() cannot be called in a server component because it changes state that only the browser has. Call it in a client component, a module that starts with 'use client'.`
      );
    }
  );

  it('fails when setupRouterGTIntegration() is called where server components render', () => {
    expect(() => setupRouterGTIntegration()).toThrow(
      'gt-tanstack-start Error: setupRouterGTIntegration() cannot be called where server components render because server components render apart from the router that it sets up. Call it where the app creates its router, in getRouter() of src/router.tsx.'
    );
  });
});

describe('the client chunks that server components name', () => {
  it('are read from every server component in the loader data, each once', () => {
    const board = createServerComponent(
      new Set(['/assets/counter-a1.js', '/assets/shared-b2.js'])
    );
    const card = createServerComponent(
      new Set(['/assets/stamp-c3.js', '/assets/shared-b2.js'])
    );

    expect(
      findClientReferenceChunks({
        Board: board,
        cards: [{ src: card }, { src: card }],
        title: 'Notices',
      })
    ).toEqual([
      '/assets/counter-a1.js',
      '/assets/shared-b2.js',
      '/assets/stamp-c3.js',
    ]);
  });

  it.each([
    ['no loader data', undefined],
    ['no server component', { title: 'Notices', rows: [1, 2] }],
    [
      'a server component that names no client chunk',
      { Board: createServerComponent(undefined) },
    ],
    [
      'a server component whose chunks are no list',
      { Board: createServerComponent(7) },
    ],
    [
      // Rendered later: its chunks are not known when the page is sent
      'a server component that is still loading',
      { Board: Promise.resolve(createServerComponent(new Set(['/a.js']))) },
    ],
  ])('are none with %s', (_case, loaderData) => {
    expect(findClientReferenceChunks(loaderData)).toEqual([]);
  });

  it('are found in loader data that refers to itself', () => {
    const loaderData: Record<string, unknown> = {
      Board: createServerComponent(['/assets/counter-a1.js']),
    };
    loaderData.self = loaderData;

    expect(findClientReferenceChunks(loaderData)).toEqual([
      '/assets/counter-a1.js',
    ]);
  });

  it('are not looked for in values that are no plain data', () => {
    class Report {
      Board = createServerComponent(['/assets/counter-a1.js']);
    }

    expect(
      findClientReferenceChunks({
        report: new Report(),
        byName: new Map([['Board', createServerComponent(['/assets/b.js'])]]),
      })
    ).toEqual([]);
  });
});
