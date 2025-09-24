'use client';

import { useEffect } from 'react';
import { useI18n } from 'fumadocs-ui/contexts/i18n';

export default function PrefetchSearchIndex() {
  const { locale } = useI18n();

  useEffect(() => {
    const run = async () => {
      // Respect data saver / slow network
      const c = (navigator as any).connection;
      const slow = c?.saveData || !['4g', '5g'].includes(c?.effectiveType);
      if (slow) return;

      try {
        // Prefetch the search API endpoint to warm the cache
        await fetch(`/api/search/${locale}`);
      } catch {
        // ignore
      }
    };

    const id =
      'requestIdleCallback' in window
        ? (window as any).requestIdleCallback(run, { timeout: 3000 })
        : setTimeout(run, 2500);

    return () => {
      if ('cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id as number);
      }
    };
  }, [locale]);

  return null;
}
