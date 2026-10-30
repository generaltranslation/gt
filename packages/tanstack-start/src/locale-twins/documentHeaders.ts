import {
  getResponseHeader,
  setResponseHeader,
} from '@tanstack/react-start/server';
import { applyLocaleTwinDocumentHeaders } from 'gt-i18n/internal/locale-twins';

/** A matched route, with the response headers its `headers()` option set. */
export type RouteMatchHeaders = { headers?: Record<string, string> };

/** Locale twin document headers this sets; Start already sets Content-Type. */
const DOCUMENT_HEADERS = ['vary', 'cache-control'];

/**
 * The document's script URLs and text depend on the locale cookie and
 * `Accept-Language`, so caches must not reuse it across locales.
 *
 * Start merges the request's response headers over the routes' `headers()`,
 * so the routes' and the request's own `Vary` values are kept in the merged
 * value, and a `Cache-Control` either of them set is left as it is.
 *
 * The headers go on the request (Start's own merge for 2xx documents) and on
 * the deepest match: Start builds the document Response from the matches'
 * headers, and H3 adds the request's response headers to 2xx responses only,
 * so a localized 404 or 500 document gets them from the match.
 */
export function setLocaleTwinDocumentHeaders(
  matches: readonly RouteMatchHeaders[]
): void {
  const headers = new Headers();
  for (const match of matches) {
    for (const [name, value] of Object.entries(match.headers ?? {})) {
      headers.set(name, value);
    }
  }
  for (const name of DOCUMENT_HEADERS) {
    const value = getResponseHeader(name);
    if (value !== undefined) headers.set(name, value);
  }
  const before = new Headers(headers);
  applyLocaleTwinDocumentHeaders(headers);
  const changed: Record<string, string> = {};
  for (const name of DOCUMENT_HEADERS) {
    const value = headers.get(name);
    if (value !== null && value !== before.get(name)) {
      setResponseHeader(name, value);
      changed[name] = value;
    }
  }
  const deepest = matches.at(-1);
  if (deepest && Object.keys(changed).length > 0) {
    deepest.headers = {
      ...Object.fromEntries(
        Object.entries(deepest.headers ?? {}).filter(
          ([name]) => !(name.toLowerCase() in changed)
        )
      ),
      ...changed,
    };
  }
}
