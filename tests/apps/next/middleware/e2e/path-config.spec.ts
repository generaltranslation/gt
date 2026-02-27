import { test, expect } from '@playwright/test';
import { expectLocaleSync } from './helpers';

// path-config use case: pathConfig with localized paths for /about
// en: /about-us, fr: /a-propos, es: /acerca-de
// prefixDefaultLocale: false

test.describe('pathConfig', () => {
  test('/about-us serves en about page (rewrite)', async ({ page }) => {
    await page.goto('/about-us');
    await expect(page).toHaveURL('/about-us');
    await expectLocaleSync(page, 'en');
    await expect(page.locator('[data-testid="page-title"]')).toHaveText(
      'About'
    );
  });

  test('/fr/a-propos serves fr about page', async ({ page }) => {
    await page.goto('/fr/a-propos');
    await expect(page).toHaveURL('/fr/a-propos');
    await expectLocaleSync(page, 'fr');
    await expect(page.locator('[data-testid="page-title"]')).toHaveText(
      'About'
    );
  });

  test('/fr/about redirects to /fr/a-propos', async ({ page }) => {
    await page.goto('/fr/about');
    await expect(page).toHaveURL('/fr/a-propos');
    await expectLocaleSync(page, 'fr');
  });

  test('locale cookie fr on /about-us redirects to /fr/a-propos', async ({
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

    await page.goto('/about-us');
    await expect(page).toHaveURL('/fr/a-propos');
    await expectLocaleSync(page, 'fr');

    await context.close();
  });

  test('locale cookie en on /fr/a-propos redirects to /about-us', async ({
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

    await page.goto('/fr/a-propos');
    await expect(page).toHaveURL('/about-us');
    await expectLocaleSync(page, 'en');

    await context.close();
  });
});
