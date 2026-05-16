/**
 * Minimally parses a cookie value for a given cookie name.
 * @param cookieName - The name of the cookie
 * @returns The cookie value, or undefined when it is not found
 */
export function getCookieValue(cookieName: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const rawCookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${cookieName}=`))
    ?.split('=')[1];
  return rawCookieValue;
}

/**
 * Sets a cookie value for a given cookie name.
 * @param cookieName - The name of the cookie
 * @param value - The value to set
 */
export function setCookieValue(cookieName: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${cookieName}=${value};path=/`;
}
