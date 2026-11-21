import { getCookieValue as getCookieValueFromString } from 'gt-i18n/internal/cookies';
import { oncePerTask } from './oncePerTask';

type Cookies = { header: string; values: Map<string, string | undefined> };

let lastCookies: Cookies | undefined;

const cookies = oncePerTask(() => {
  const header = typeof document === 'undefined' ? '' : document.cookie;
  // Most tasks find the cookies as the last one read them, already parsed.
  if (lastCookies?.header !== header) {
    lastCookies = { header, values: new Map() };
  }
  return lastCookies;
});

/** The cookies as this task reads them: one object until a cookie changes. */
export const getTaskCookies = cookies.get;

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
  const { header, values } = cookies.get();
  if (!values.has(cookieName)) {
    values.set(cookieName, getCookieValueFromString(header, cookieName));
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
  cookies.clear();
}
