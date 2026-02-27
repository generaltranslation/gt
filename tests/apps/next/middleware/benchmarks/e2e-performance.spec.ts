import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(__dirname, 'results');

interface NavigationMetrics {
  ttfb: number;
  domContentLoaded: number;
  load: number;
}

async function getNavigationMetrics(
  page: import('@playwright/test').Page
): Promise<NavigationMetrics> {
  return page.evaluate(() => {
    const entry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming;
    return {
      ttfb: entry.responseStart - entry.requestStart,
      domContentLoaded:
        entry.domContentLoadedEventEnd - entry.requestStart,
      load: entry.loadEventEnd - entry.requestStart,
    };
  });
}

test.describe('e2e performance benchmarks', () => {
  const results: Record<string, unknown> = {};

  test.afterAll(() => {
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(
      join(RESULTS_DIR, `perf-${Date.now()}.json`),
      JSON.stringify(results, null, 2)
    );
  });

  test('cold navigation TTFB and load times', async ({ page }) => {
    await page.goto('/');
    const metrics = await getNavigationMetrics(page);
    results['cold-navigation-home'] = metrics;
    console.log('Cold navigation (/):', metrics);
  });

  test('redirect chain latency (fr user -> /about -> /fr/about)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'fr' });
    const page = await context.newPage();

    const start = Date.now();
    await page.goto('/about');
    const elapsed = Date.now() - start;

    const metrics = await getNavigationMetrics(page);
    results['redirect-chain-fr-about'] = { elapsed, ...metrics };
    console.log('Redirect chain (fr /about):', { elapsed, ...metrics });

    await context.close();
  });

  test('locale switch round-trip time', async ({ page }) => {
    await page.goto('/');

    // Measure setLocale(fr) -> settled
    const start = Date.now();
    await page.locator('[data-testid="switch-fr"]').click();
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;

    results['locale-switch-en-to-fr'] = { elapsed };
    console.log('Locale switch (en -> fr):', { elapsed });
  });

  test('about page cold navigation', async ({ page }) => {
    await page.goto('/about');
    const metrics = await getNavigationMetrics(page);
    results['cold-navigation-about'] = metrics;
    console.log('Cold navigation (/about):', metrics);
  });
});
