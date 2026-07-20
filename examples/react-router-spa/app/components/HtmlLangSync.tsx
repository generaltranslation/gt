import { useEffect } from 'react';
import { useLocale, useLocaleDirection } from 'gt-react';

// Syncs the html element's lang and dir attributes to the active locale.
//
// root.tsx renders a static lang='en' shell because it runs during the
// build-time prerender, where gt-react is not initialized. This component runs
// only in the browser, so it lives in the route module graph (rendered from the
// route components), never in root.tsx. It calls gt-react hooks, which resolve
// because gt-react has already initialized by the time any route renders.
export function HtmlLangSync() {
  const locale = useLocale();
  const direction = useLocaleDirection();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return null;
}
