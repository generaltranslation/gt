'use client';

import { useEffect } from 'react';
import { useI18n } from 'fumadocs-ui/contexts/i18n';

export default function PrefetchSearchIndex() {
  const { locale } = useI18n();

  useEffect(() => {
    // Add optional types for browser idle APIs
    type WindowWithIdle = Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const run = async () => {
      try {
        // Ask the browser to download the search data for this language.
        // The result is stored in the HTTP cache automatically.
        await fetch(`/api/search/${locale}`);
      } catch {
        // If it fails (offline, etc.), just ignore it.
      }
    };

    const w = window as WindowWithIdle;
    // If the browser supports "run this when you’re idle", use that.
    // Otherwise, fall back to a short delay.
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
