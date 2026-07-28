import { useEffect } from 'react';
import { useLocale, useLocaleDirection } from 'gt-react';

// Syncs the html lang and dir attributes to the active locale.
// Lives in the route graph, not root.tsx: gt-react is not initialized during the
// build-time prerender, so its hooks only resolve once a route renders.
export function HtmlLangSync() {
  const locale = useLocale();
  const direction = useLocaleDirection();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return null;
}
