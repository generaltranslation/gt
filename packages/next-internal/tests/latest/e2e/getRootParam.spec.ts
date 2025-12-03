import { test, expect } from '@playwright/test';

test.describe('getRootParam function', () => {
  test('should resolve module correctly', async ({ page }) => {
    await page.goto('/en');

    // Verify the page loads without module resolution errors
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Locale Test Page');
  });

  test('should have getRootParam function available', async ({ page }) => {
    await page.goto('/en');

    // Verify that the function is working by checking for data-testid elements
    await expect(page.locator('[data-testid="locale-result"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="nonexistent-result"]')
    ).toBeAttached();
    await expect(
      page.locator('[data-testid="high-index-result"]')
    ).toBeAttached();

    // Verify that the function returns actual values
    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"en"'
    );
  });

  test('should not show module not found errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/en');
    await page.waitForLoadState('networkidle');

    // Check that no "Module not found" errors occurred
    const moduleErrors = errors.filter(
      (error) =>
        error.includes('Module not found') ||
        error.includes('@generaltranslation/next-internal')
    );
    expect(moduleErrors).toHaveLength(0);
  });
  test('should extract basic parameter from URL', async ({ page }) => {
    await page.goto('/en');

    await expect(page.locator('h1')).toContainText('Locale Test Page');
    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"en"'
    );
  });

  test('should return undefined for nonexistent parameter', async ({
    page,
  }) => {
    await page.goto('/en');

    await expect(
      page.locator('[data-testid="nonexistent-result"]')
    ).toContainText('undefined');
  });

  test('should return undefined for invalid index', async ({ page }) => {
    await page.goto('/en');

    await expect(
      page.locator('[data-testid="high-index-result"]')
    ).toContainText('undefined');
  });

  test('should extract multiple parameters from URL', async ({ page }) => {
    await page.goto('/fr/CA');

    await expect(page.locator('h1')).toContainText(
      'Locale and Region Test Page'
    );
    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"fr"'
    );
    await expect(page.locator('[data-testid="region-result"]')).toContainText(
      '"CA"'
    );
  });

  test('should extract parameter with explicit index', async ({ page }) => {
    await page.goto('/es/MX');

    await expect(
      page.locator('[data-testid="region-explicit-result"]')
    ).toContainText('"MX"');
  });

  test('should work with different parameter values', async ({ page }) => {
    await page.goto('/de/AT');

    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"de"'
    );
    await expect(page.locator('[data-testid="region-result"]')).toContainText(
      '"AT"'
    );
  });

  test('should handle route groups correctly', async ({ page }) => {
    await page.goto('/it/settings');

    await expect(page.locator('h1')).toContainText(
      'Dashboard Settings Test Page'
    );
    
    // This test should extract 'it' from URL /it/settings with route pattern (dashboard)/[locale]/settings
    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"it"'
    );
  });

  test('should work with numeric parameter values', async ({ page }) => {
    await page.goto('/123');

    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"123"'
    );
  });

  test('should work with special characters in parameter values', async ({
    page,
  }) => {
    await page.goto('/zh-CN');

    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"zh-CN"'
    );
  });

  test('should handle URL encoded parameter values', async ({ page }) => {
    await page.goto('/hello%20world');

    await expect(page.locator('[data-testid="locale-result"]')).toContainText(
      '"hello%20world"'
    );
  });
});
