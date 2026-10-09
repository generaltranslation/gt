import {
  prefixLocaleSegment,
  splitLocaleSegment,
} from '../functions/localeRouting';
import type {
  GTIntegrableRouter,
  GTLocationRewrite,
  GTLocationRewriteFunction,
} from './types';

/**
 * Keep app routes and links locale-free: input removes a supported locale
 * prefix and output adds the current non-default locale. Router strips its
 * basepath before input and adds it after output, so both see basepath-free
 * URLs.
 */
export function createLocaleRewrite(
  getLocale: () => string
): GTLocationRewrite {
  return {
    input: ({ url }) => {
      const { locale, pathname } = splitLocaleSegment(url.pathname);
      return locale ? withPathname(url, pathname) : undefined;
    },
    // Output receives an internal pathname, so it must not strip a leading
    // locale-shaped segment: /fr/fr/about routes to /fr/about and back.
    output: ({ url }) => {
      const pathname = prefixLocaleSegment(url.pathname, getLocale());
      return pathname === url.pathname
        ? undefined
        : withPathname(url, pathname);
    },
  };
}

/**
 * The rewrite GT installs on a router: the locale rewrite runs before the
 * app's input rewrite and after its output rewrite, so the app's rewrite sees
 * locale-free URLs.
 */
export function getRouterLocaleRewrite(
  router: GTIntegrableRouter,
  getLocale: () => string
): GTLocationRewrite {
  const localeRewrite = createLocaleRewrite(getLocale);
  const appRewrite = router.options.rewrite;
  return appRewrite
    ? composeLocationRewrites([localeRewrite, appRewrite])
    : localeRewrite;
}

/**
 * Same semantics as TanStack Router's composeRewrites(), which this package
 * cannot import without depending on the router: inputs run in order, outputs
 * in reverse, and an empty result keeps the current URL.
 */
export function composeLocationRewrites(
  rewrites: GTLocationRewrite[]
): GTLocationRewrite {
  return {
    input: ({ url }) =>
      rewrites.reduce(
        (current, { input }) => applyRewrite(input, current),
        url
      ),
    output: ({ url }) =>
      rewrites.reduceRight(
        (current, { output }) => applyRewrite(output, current),
        url
      ),
  };
}

function applyRewrite(
  rewrite: GTLocationRewriteFunction | undefined,
  url: URL
): URL {
  const result = rewrite?.({ url });
  if (!result) return url;
  return typeof result === 'string' ? new URL(result) : result;
}

// Router derives href from the URL it passes to output, so return a copy.
function withPathname(url: URL, pathname: string): URL {
  const rewritten = new URL(url.href);
  rewritten.pathname = pathname;
  return rewritten;
}
