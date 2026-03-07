import { test, expect } from '@playwright/test';
import { expectLocaleSync } from './helpers';

// prefix-default use case: prefixDefaultLocale = true
// All locales including default (en) are prefixed in the URL.

test.describe('prefixDefaultLocale: true', () => {
  test('/ redirects to /en/', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en/);
    await expectLocaleSync(page, 'en');
  });

  test('/en/about passes through', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page).toHaveURL('/en/about');
    await expectLocaleSync(page, 'en');
  });

  test('/about redirects to /en/about', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL('/en/about');
    await expectLocaleSync(page, 'en');
  });

  test('locale cookie fr redirects /en/about to /fr/about', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

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

    await page.goto('/en/about');
    await expect(page).toHaveURL('/fr/about');
    await expectLocaleSync(page, 'fr');

    await context.close();
  });

  test('locale cookie en redirects /fr/about to /en/about', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

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

    await page.goto('/fr/about');
    await expect(page).toHaveURL('/en/about');
    await expectLocaleSync(page, 'en');

    await context.close();
  });
});
