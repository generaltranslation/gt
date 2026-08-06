import { getCookieValue } from './request';

type CookieDocument = {
  cookie: string;
};

/**
 * Reads and decodes a browser cookie without accessing `document` during SSR.
 *
 * @param cookieName - Exact cookie name to read.
 * @returns The decoded cookie value, or `undefined` outside a browser or when
 * the cookie is absent.
 */
export function getBrowserCookieValue(cookieName: string): string | undefined {
  const cookieDocument = getCookieDocument();
  return cookieDocument
    ? getCookieValue(cookieDocument.cookie, cookieName)
    : undefined;
}

/**
 * Writes a path-wide browser session cookie without accessing `document`
 * during SSR.
 *
 * The serialized form intentionally matches the existing GT React browser
 * store so all web runtimes share the same cookie contract.
 *
 * @param cookieName - Cookie name to write.
 * @param value - Raw cookie value to persist.
 */
export function setBrowserCookieValue(cookieName: string, value: string): void {
  const cookieDocument = getCookieDocument();
  if (cookieDocument) {
    cookieDocument.cookie = `${cookieName}=${value};path=/`;
  }
}

function getCookieDocument(): CookieDocument | undefined {
  return (
    globalThis as typeof globalThis & {
      document?: CookieDocument;
    }
  ).document;
}
