'use client';

import { useEffect } from 'react';
import { useI18n } from 'fumadocs-ui/contexts/i18n';

export default function PrefetchSearchIndex() {
  const { locale } = useI18n();

  useEffect(() => {
    type WindowWithIdle = Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const run = async () => {
      try {
        // Prefetch the search API endpoint to warm the cache
        await fetch(`/api/search/${locale}`);
      } catch {
        // Ignore
      }
    };

    const w = window as WindowWithIdle;
    const id =
      'requestIdleCallback' in w && typeof w.requestIdleCallback === 'function'
        ? w.requestIdleCallback(run, { timeout: 3000 })
        : (setTimeout(run, 2500) as unknown as number);

    return () => {
      if (
        'cancelIdleCallback' in w &&
        typeof w.cancelIdleCallback === 'function'
      ) {
        w.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [locale]);

  return null;
}
