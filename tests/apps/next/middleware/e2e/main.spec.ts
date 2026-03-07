import { test, expect } from '@playwright/test';
import {
  expectServerLocale,
  expectClientLocale,
  expectHtmlLang,
  expectLocaleSync,
  getCookies,
} from './helpers';

// main use case: prefixDefaultLocale = false
// Default locale (en) has no URL prefix; non-default locales (fr, es) are prefixed.

test.describe('main (prefixDefaultLocale: false)', () => {
  test('/ serves default locale via rewrite (no /en/ in URL)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expectLocaleSync(page, 'en');
  });

  test('/fr/about passes through for non-default locale', async ({
    page,
  }) => {
    await page.goto('/fr/about');
    await expect(page).toHaveURL('/fr/about');
    await expectLocaleSync(page, 'fr');
  });

  test('direct nav to /fr syncs client locale', async ({ page }) => {
    await page.goto('/fr');
    await expect(page).toHaveURL(/\/fr/);
    await expectServerLocale(page, 'fr');
    await expectClientLocale(page, 'fr');
    await expectHtmlLang(page, 'fr');
  });

  test('locale cookie fr causes / to redirect to /fr/', async ({
    browser,
  }) => {
    // Simulate a user who has locale=fr and reset cookies set (as setLocale would)
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set locale cookies as setLocale() would
    await context.addCookies([
      {
        name: 'generaltranslation.locale',
        value: 'fr',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'generaltranslation.locale-reset',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Navigate — middleware should see reset cookie and redirect to /fr/
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr/);
    await expectLocaleSync(page, 'fr');

    await context.close();
  });

  test('locale cookie en from /fr/about redirects to /about (strips prefix)', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set cookies as if user called setLocale('en') while on a /fr/ page
    await context.addCookies([
      {
        name: 'generaltranslation.locale',
        value: 'en',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'generaltranslation.locale-reset',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Navigate to /fr/about — middleware should redirect to /about (strip prefix for default locale)
    await page.goto('/fr/about');
    await expect(page).toHaveURL('/about');
    await expectLocaleSync(page, 'en');

    await context.close();
  });

  test('middleware sets locale-routing-enabled cookie', async ({ page }) => {
    await page.goto('/');
    const cookies = await getCookies(page);
    expect(cookies['generaltranslation.locale-routing-enabled']).toBe('true');
  });
});
