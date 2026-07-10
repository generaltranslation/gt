import { getCookieValue as getCookieValueFromString } from 'gt-i18n/internal';

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
}: {
  cookieName: string;
  value: string;
}): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${cookieName}=${value};path=/`;
}
