import {
  getResponseHeader,
  setResponseHeader,
} from '@tanstack/react-start/server';
import { getLocaleTwinDocumentHeaders } from 'gt-i18n/internal/locale-twins';

/** The response headers a matched route sets with its `headers()` option. */
export type RouteHeaders = Record<string, string> | undefined;

/**
 * The document's script URLs and text depend on the locale cookie and
 * `Accept-Language`, so caches must not reuse it across locales.
 *
 * Start merges the request's response headers over the routes' `headers()`,
 * so the routes' and the request's own `Vary` values are kept in the merged
 * value, and a `Cache-Control` either of them set is left as it is.
 */
export function setLocaleTwinDocumentHeaders(
  routeHeaders: readonly RouteHeaders[]
): void {
  const current = new Headers();
  for (const headers of routeHeaders) {
    for (const [name, value] of Object.entries(headers ?? {})) {
      current.set(name, value);
    }
  }
  for (const name of ['vary', 'cache-control']) {
    const value = getResponseHeader(name);
    if (value !== undefined) current.set(name, value);
  }

  const documentHeaders = new Headers(getLocaleTwinDocumentHeaders());
  setResponseHeader(
    'vary',
    mergeVary(current.get('vary'), documentHeaders.get('vary') ?? '')
  );
  if (!current.has('cache-control')) {
    setResponseHeader(
      'cache-control',
      documentHeaders.get('cache-control') ?? ''
    );
  }
}

function mergeVary(current: string | null, added: string): string {
  const values = (current ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const lowerCased = new Set(values.map((value) => value.toLowerCase()));
  for (const value of added.split(',').map((item) => item.trim())) {
    if (value && !lowerCased.has(value.toLowerCase())) {
      values.push(value);
      lowerCased.add(value.toLowerCase());
    }
  }
  return values.join(', ');
}
