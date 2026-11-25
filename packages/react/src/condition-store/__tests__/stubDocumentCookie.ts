import { vi } from 'vitest';

/**
 * Stubs `document` with a cookie jar, so no DOM is needed, and counts the
 * reads of `document.cookie`.
 */
export function stubDocumentCookie(cookieValues: Map<string, string>): {
  reads: number;
} {
  const cookie = { reads: 0 };
  vi.stubGlobal('document', {
    get cookie() {
      cookie.reads++;
      return [...cookieValues]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    },
    set cookie(written: string) {
      const [name, value] = written.split(';')[0].split('=');
      cookieValues.set(name, value);
    },
  });
  return cookie;
}
