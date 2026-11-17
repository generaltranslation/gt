import { getCookieValue as getCookieValueFromString } from 'gt-i18n/internal/cookies';
import { oncePerTask } from './oncePerTask';

const cookieValues = oncePerTask(() => new Map<string, string | undefined>());

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
  const values = cookieValues.get();
  if (!values.has(cookieName)) {
    values.set(
      cookieName,
      getCookieValueFromString(document.cookie, cookieName)
    );
  }
  return values.get(cookieName);
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
  cookieValues.clear();
}
