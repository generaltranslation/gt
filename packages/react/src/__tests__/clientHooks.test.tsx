// @vitest-environment jsdom
import {
  act,
  startTransition,
  StrictMode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import {
  GTProvider,
  initializeGT,
  useGT,
  useTranslations,
} from '../index.client';
import type { GTFunctionType } from 'gt-i18n/types';

type TestGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

/**
 * Stubs runtime translation. Records every requested source string and
 * answers with `translations[source]` once `responsesReleased` resolves.
 * jsdom's AbortSignal cannot reach Node's Request, so the stub replaces
 * `GTRuntime.translateMany` rather than `fetch`.
 */
function stubRuntimeApi(
  translations: Record<string, string> = {},
  responsesReleased: Promise<void> = Promise.resolve()
) {
  const requestedSources: string[] = [];
  vi.spyOn(GTRuntime.prototype, 'translateMany').mockImplementation((async (
    requests: Record<string, { source: string }>
  ) => {
    const entries = Object.entries(requests);
    requestedSources.push(...entries.map(([, { source }]) => source));
    await responsesReleased;
    return Object.fromEntries(
      entries
        .filter(([, { source }]) => source in translations)
        .map(([hash, { source }]) => [
          hash,
          {
            success: true,
            translation: translations[source],
            locale: 'fr',
            dataFormat: 'ICU',
          },
        ])
    );
  }) as never);
  return requestedSources;
}

describe('client hooks', () => {
  let root: Root;
  let element: HTMLDivElement;

  beforeEach(() => {
    // Drop GT singletons from the previous test, keeping the React context
    // captured by InternalGTProvider at import time.
    const registry = Reflect.get(globalThis, '__generaltranslation');
    if (registry) Reflect.deleteProperty(registry, 'i18n');
    (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = true;
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);
  });

  afterEach(() => {
    (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('useGT identity', () => {
    it.each(['en', 'fr'])(
      'keeps gt stable across renders for locale %s',
      async (locale) => {
        initializeGT({ defaultLocale: 'en', locales: ['en', 'fr'] });
        const identities = new Set<unknown>();
        let effectRuns = 0;
        let rerender!: () => void;

        function Loader() {
          const gt = useGT();
          identities.add(gt);
          const [, setTick] = useState(0);
          rerender = () => setTick((tick) => tick + 1);
          const [label, setLabel] = useState('');
          useEffect(() => {
            effectRuns++;
            setLabel(gt('Loaded'));
          }, [gt]);
          return <span>{label}</span>;
        }

        await act(async () => {
          root.render(
            <GTProvider locale={locale} translations={{ [locale]: {} }}>
              <Loader />
            </GTProvider>
          );
        });
        await act(async () => rerender());

        expect(element.textContent).toBe('Loaded');
        expect(effectRuns).toBe(1);
        expect(identities.size).toBe(1);
      }
    );
  });

  // Each test looks up its own source strings: delivered translations are
  // persisted to localStorage, which outlives the test.
  describe('dev hot reload', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
      // Unanswered lookups log a runtime translation error
      vi.spyOn(console, 'error').mockImplementation(() => {});
      initializeGT({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        devApiKey: 'gtx-dev-test',
        projectId: 'test-project',
      });
    });

    it('updates direct, memoized, and effect-derived useGT strings when a translation arrives', async () => {
      let releaseResponses!: () => void;
      const requestedSources = stubRuntimeApi(
        { Hello: 'Bonjour', Goodbye: 'Au revoir' },
        new Promise<void>((resolve) => {
          releaseResponses = resolve;
        })
      );

      function Greeting() {
        const gt = useGT();
        const direct = gt('Hello');
        const memoized = useMemo(() => gt('Hello'), [gt]);
        const [fromEffect, setFromEffect] = useState('');
        const [effectOnly, setEffectOnly] = useState('');
        useEffect(() => {
          setFromEffect(gt('Hello'));
          // Only ever looked up outside of render
          setEffectOnly(gt('Goodbye'));
        }, [gt]);
        return (
          <span>{[direct, memoized, fromEffect, effectOnly].join('|')}</span>
        );
      }

      await act(async () => {
        root.render(
          <GTProvider locale='fr' translations={{ fr: {} }}>
            <Greeting />
          </GTProvider>
        );
      });
      await vi.waitFor(
        () =>
          expect(requestedSources).toEqual(
            expect.arrayContaining(['Hello', 'Goodbye'])
          ),
        { timeout: 2000 }
      );
      expect(element.textContent).toBe('Hello|Hello|Hello|Goodbye');

      await act(async () => releaseResponses());
      await vi.waitFor(
        () =>
          expect(element.textContent).toBe('Bonjour|Bonjour|Bonjour|Au revoir'),
        { timeout: 2000 }
      );
    });

    it('requests memoized useGT lookups in strict mode', async () => {
      const requestedSources = stubRuntimeApi();

      function Greeting() {
        const gt = useGT();
        // Strict mode reuses this result in its second render
        const label = useMemo(() => gt('Memoized'), [gt]);
        return <span>{label}</span>;
      }

      await act(async () => {
        root.render(
          <StrictMode>
            <GTProvider locale='fr' translations={{ fr: {} }}>
              <Greeting />
            </GTProvider>
          </StrictMode>
        );
      });
      await vi.waitFor(() => expect(requestedSources).toContain('Memoized'), {
        timeout: 2000,
      });
    });

    it('requests useGT lookups from children rendered after the scheduler yields on mount', async () => {
      const requestedSources = stubRuntimeApi();
      // act() renders without yielding; this test needs real time slicing
      (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = false;
      const events: string[] = [];

      function Parent() {
        const gt = useGT();
        events.push('parent');
        void Promise.resolve().then(() => events.push('microtask'));
        // Use up the scheduler's time slice so React yields before the child
        const start = performance.now();
        while (performance.now() - start < 20) {
          // busy wait
        }
        return <Child gt={gt} />;
      }

      function Child({ gt }: { gt: GTFunctionType }) {
        events.push('child');
        return <span>{gt('Child-only')}</span>;
      }

      startTransition(() => {
        root.render(
          <GTProvider locale='fr' translations={{ fr: {} }}>
            <Parent />
          </GTProvider>
        );
      });
      await vi.waitFor(() => expect(element.textContent).toBe('Child-only'), {
        timeout: 2000,
      });
      // The parent's render queue expired before the child rendered
      expect(events.slice(0, 3)).toEqual(['parent', 'microtask', 'child']);
      await vi.waitFor(() => expect(requestedSources).toContain('Child-only'), {
        timeout: 2000,
      });
    });

    it('updates memoized useTranslations dictionary objects when a translation arrives', async () => {
      stubRuntimeApi({ Welcome: 'Bienvenue' });

      function Group() {
        const t = useTranslations();
        const title = () => (t.obj('group') as { title: string }).title;
        const direct = title();
        const memoized = useMemo(title, [t]);
        return <span>{`${direct}|${memoized}`}</span>;
      }

      await act(async () => {
        root.render(
          <GTProvider
            locale='fr'
            translations={{ fr: {} }}
            dictionaries={{ en: { group: { title: 'Welcome' } } }}
          >
            <Group />
          </GTProvider>
        );
      });
      await vi.waitFor(
        () => expect(element.textContent).toBe('Bienvenue|Bienvenue'),
        { timeout: 2000 }
      );
    });
  });
});
