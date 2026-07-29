import { getCookieValue as getCookieValueFromString } from 'gt-i18n/internal';

export type CookieOptions = {
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
};

/**
 * Minimally parses a cookie value for a given cookie name
 * @param cookieName - The name of the cookie
 * @returns The locale from the cookie or undefined if not found or invalid
 */
export function getCookieValue({
  cookieName,
}: {
  cookieName: string;
}): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return getCookieValueFromString(document.cookie, cookieName);
}

/**
 * Sets a cookie value for a given cookie name
 * @param cookieName - The name of the cookie
 * @param value - The value to set
 * @returns The value that was set
 */
export function setCookieValue({
  cookieName,
  value,
  options,
}: {
  cookieName: string;
  value: string;
  options?: CookieOptions;
}): void {
  if (typeof document === 'undefined') return;
  document.cookie = serializeCookieValue({ cookieName, value, options });
}

/** @internal */
export function serializeCookieValue({
  cookieName,
  value,
  options,
}: {
  cookieName: string;
  value: string;
  options?: CookieOptions;
}): string {
  const attributes = [`Path=${options?.path ?? '/'}`];
  if (options?.maxAge !== undefined) {
    attributes.push(`Max-Age=${options.maxAge}`);
  }
  if (options?.sameSite) {
    const sameSite =
      options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
    attributes.push(`SameSite=${sameSite}`);
  }
  if (options?.secure) {
    attributes.push('Secure');
  }
  return `${cookieName}=${value};${attributes.join(';')}`;
}
