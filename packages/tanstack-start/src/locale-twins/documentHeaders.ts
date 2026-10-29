import {
  getResponseHeader,
  setResponseHeader,
} from '@tanstack/react-start/server';
import { applyLocaleTwinDocumentHeaders } from 'gt-i18n/internal/locale-twins';

/** The response headers a matched route sets with its `headers()` option. */
export type RouteHeaders = Record<string, string> | undefined;

/** Locale twin document headers this sets; Start already sets Content-Type. */
const DOCUMENT_HEADERS = ['vary', 'cache-control'];

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
  const headers = new Headers();
  for (const route of routeHeaders) {
    for (const [name, value] of Object.entries(route ?? {})) {
      headers.set(name, value);
    }
  }
  for (const name of DOCUMENT_HEADERS) {
    const value = getResponseHeader(name);
    if (value !== undefined) headers.set(name, value);
  }
  const before = new Headers(headers);
  applyLocaleTwinDocumentHeaders(headers);
  for (const name of DOCUMENT_HEADERS) {
    const value = headers.get(name);
    if (value !== null && value !== before.get(name)) {
      setResponseHeader(name, value);
    }
  }
}
