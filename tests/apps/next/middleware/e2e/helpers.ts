import { expect, Page } from '@playwright/test';

/**
 * Assert server-rendered locale matches expected value.
 */
export async function expectServerLocale(page: Page, locale: string) {
  await expect(page.locator('[data-testid="server-locale"]')).toHaveText(
    locale
  );
}

/**
 * Assert client-side locale (from useLocale()) matches expected value.
 */
export async function expectClientLocale(page: Page, locale: string) {
  await expect(page.locator('[data-testid="client-locale"]')).toHaveText(
    locale
  );
}

/**
 * Assert <html lang> attribute matches expected locale.
 */
export async function expectHtmlLang(page: Page, locale: string) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

/**
 * Assert server locale, client locale, and html lang all match.
 */
export async function expectLocaleSync(page: Page, locale: string) {
  await expectServerLocale(page, locale);
  await expectClientLocale(page, locale);
  await expectHtmlLang(page, locale);
}

/**
 * Click a locale switch button and wait for the redirect chain to settle.
 * setLocale() sets cookies + calls router.refresh() → middleware redirect → settle.
 */
export async function switchLocale(page: Page, locale: string) {
  await page.locator(`[data-testid="switch-${locale}"]`).click();
  // Wait for any redirects and RSC refreshes to complete
  await page.waitForLoadState('networkidle');
  // Give the client-server sync loop time to settle
  // (ClientProviderWrapper may detect mismatch and trigger additional refreshes)
  await page.waitForTimeout(1000);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for client-side effects (useEffect in ClientProviderWrapper)
 * to run and set cookies like referrer-locale.
 */
export async function waitForClientEffects(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Get all cookies from the page's browser context as a Record.
 */
export async function getCookies(
  page: Page
): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return Object.fromEntries(cookies.map((c) => [c.name, c.value]));
}

/**
 * Assert a specific cookie has the expected value.
 */
export async function expectCookie(
  page: Page,
  name: string,
  value: string
) {
  const cookies = await getCookies(page);
  expect(cookies[name]).toBe(value);
}

/**
 * Assert a specific cookie does not exist.
 */
export async function expectNoCookie(page: Page, name: string) {
  const cookies = await getCookies(page);
  expect(cookies[name]).toBeUndefined();
}
