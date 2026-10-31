// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GTProvider, initializeGT, useGT } from '../index.client';

type TestGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('useGT identity in development', () => {
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
  });

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
