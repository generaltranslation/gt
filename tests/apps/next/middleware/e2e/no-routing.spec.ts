import { test, expect } from '@playwright/test';
import {
  expectServerLocale,
  expectCookie,
} from './helpers';

// no-routing use case: localeRouting = false
// Middleware does NOT redirect or rewrite based on locale.
// Requests pass through to Next.js routing as-is.
// Only [locale]/ routes exist, so paths must include the locale segment.

test.describe('localeRouting: false', () => {
  test('/en passes through without redirect', async ({ page }) => {
    await page.goto('/en');
    await expect(page).toHaveURL('/en');
    await expect(page.locator('[data-testid="page-title"]')).toHaveText(
      'Home'
    );
  });

  test('/en/about passes through without redirect', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page).toHaveURL('/en/about');
    await expect(page.locator('[data-testid="page-title"]')).toHaveText(
      'About'
    );
  });

  test('/fr/about passes through without redirect', async ({ page }) => {
    await page.goto('/fr/about');
    await expect(page).toHaveURL('/fr/about');
  });

  test('locale-routing-enabled cookie is set to false', async ({
    page,
  }) => {
    await page.goto('/en');
    await expectCookie(
      page,
      'generaltranslation.locale-routing-enabled',
      'false'
    );
  });

  test('server locale resolves to default', async ({ page }) => {
    await page.goto('/en');
    await expectServerLocale(page, 'en');
  });
});
