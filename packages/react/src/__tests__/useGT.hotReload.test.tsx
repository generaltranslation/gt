// @vitest-environment jsdom
import {
  act,
  startTransition,
  StrictMode,
  Suspense,
  use,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRuntimeApiUrl } from 'generaltranslation/internal';
import { GTProvider, initializeGT, useGT } from '../index.client';

type TestGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

/**
 * Stubs the runtime translation API. Records every requested source string and
 * answers with `translations[source]` once `responsesReleased` resolves.
 */
function stubRuntimeApi(
  translations: Record<string, string> = {},
  responsesReleased: Promise<void> = Promise.resolve()
) {
  const requestedSources: string[] = [];
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
        requests: Record<string, { source: string }>;
      };
      const entries = Object.entries(requests);
      requestedSources.push(...entries.map(([, { source }]) => source));
      await responsesReleased;
      return Response.json(
        Object.fromEntries(
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
        )
      );
    }
  );
  return requestedSources;
}

describe('useGT dev hot reload', () => {
  let root: Root;
  let element: HTMLDivElement;

  beforeEach(() => {
    (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubEnv('NODE_ENV', 'development');
    // Unanswered lookups log a runtime translation error
    vi.spyOn(console, 'error').mockImplementation(() => {});
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      devApiKey: 'gtx-dev-test',
      projectId: 'test-project',
    });
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

  it('updates direct, memoized, and effect-derived strings when a translation arrives', async () => {
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

  it('requests lookups made in event handlers', async () => {
    const requestedSources = stubRuntimeApi();
    let onClick!: () => void;

    function Button() {
      const gt = useGT();
      onClick = () => gt('Clicked');
      return null;
    }

    await act(async () => {
      root.render(
        <GTProvider locale='fr' translations={{ fr: {} }}>
          <Button />
        </GTProvider>
      );
    });
    act(() => onClick());
    await vi.waitFor(() => expect(requestedSources).toContain('Clicked'), {
      timeout: 2000,
    });
  });

  it('does not request lookups from renders that never commit', async () => {
    const requestedSources = stubRuntimeApi();
    const never = new Promise<never>(() => {});
    let suspend!: () => void;
    let showUrgent!: () => void;

    function Greeting() {
      const gt = useGT();
      const [suspended, setSuspended] = useState(false);
      const [urgent, setUrgent] = useState(false);
      suspend = () => startTransition(() => setSuspended(true));
      showUrgent = () => setUrgent(true);
      if (suspended) {
        // This transition render suspends forever, so it never commits
        gt('Abandoned');
        use(never);
      }
      return <span>{urgent ? gt('Urgent') : gt('Saved')}</span>;
    }

    await act(async () => {
      root.render(
        <GTProvider locale='fr' translations={{ fr: {} }}>
          <Suspense fallback={null}>
            <Greeting />
          </Suspense>
        </GTProvider>
      );
    });
    await vi.waitFor(() => expect(requestedSources).toContain('Saved'), {
      timeout: 2000,
    });

    await act(async () => suspend());
    expect(element.textContent).toBe('Saved');
    // An urgent update commits while the transition is still suspended
    await act(async () => showUrgent());
    expect(element.textContent).toBe('Urgent');
    await vi.waitFor(() => expect(requestedSources).toContain('Urgent'), {
      timeout: 2000,
    });
    expect(requestedSources).not.toContain('Abandoned');
  });

  it('requests event handler lookups while a transition is suspended', async () => {
    const requestedSources = stubRuntimeApi();
    const never = new Promise<never>(() => {});
    let suspend!: () => void;

    function Greeting() {
      const gt = useGT();
      const [suspended, setSuspended] = useState(false);
      const [label, setLabel] = useState('');
      suspend = () => startTransition(() => setSuspended(true));
      if (suspended) {
        gt('Abandoned');
        use(never);
      }
      return <button onClick={() => setLabel(gt('Clicked'))}>{label}</button>;
    }

    await act(async () => {
      root.render(
        <GTProvider locale='fr' translations={{ fr: {} }}>
          <Suspense fallback={null}>
            <Greeting />
          </Suspense>
        </GTProvider>
      );
    });
    await act(async () => suspend());
    // The suspended transition leaves the committed UI interactive
    await act(async () => element.querySelector('button')!.click());
    expect(element.textContent).toBe('Clicked');
    await vi.waitFor(() => expect(requestedSources).toContain('Clicked'), {
      timeout: 2000,
    });
    expect(requestedSources).not.toContain('Abandoned');
  });

  it('requests memoized lookups in strict mode', async () => {
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
});
