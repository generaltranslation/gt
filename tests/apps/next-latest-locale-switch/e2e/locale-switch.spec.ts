import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const localeRouting = process.env.GT_LOCALE_ROUTING === 'true';
const prefixDefaultLocale = process.env.GT_PREFIX_DEFAULT_LOCALE === 'true';
const localeSelectorName = 'General Translation locale selector';
const content = {
  en: 'English content',
  fr: 'Contenu français',
  de: 'Deutscher Inhalt',
} as const;

for (const route of [
  { name: 'root', suffix: '' },
  { name: 'nested', suffix: '/nested' },
] as const) {
  test(`${route.name}: default to nondefault to nondefault to default`, async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(route.suffix || '/');

    await expectLocale(page, 'en', route.name, route.suffix);
    await selectLocale(page, 'fr');
    await expectLocale(page, 'fr', route.name, route.suffix);
    await selectLocale(page, 'de');
    await expectLocale(page, 'de', route.name, route.suffix);
    await selectLocale(page, 'en');
    await expectLocale(page, 'en', route.name, route.suffix);
  });
}

async function selectLocale(page: Page, locale: keyof typeof content) {
  await page
    .getByRole('combobox', { name: localeSelectorName })
    .selectOption(locale);
}

async function expectLocale(
  page: Page,
  locale: keyof typeof content,
  route: 'root' | 'nested',
  suffix: '' | '/nested'
) {
  await expect(page).toHaveURL(
    (url) => url.pathname === pathFor(locale, suffix)
  );
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByText(`Route: ${route}`)).toBeVisible();
  await expect(page.getByText(`Server locale: ${locale}`)).toBeVisible();
  await expect(
    page.getByText(`Server content: ${content[locale]}`)
  ).toBeVisible();
  await expect(page.getByText(`Client locale: ${locale}`)).toBeVisible();
  await expect(
    page.getByText(`Client content: ${content[locale]}`)
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: localeSelectorName })
  ).toHaveValue(locale);
}

function pathFor(locale: keyof typeof content, suffix: '' | '/nested') {
  if (!localeRouting) {
    return suffix || '/';
  }

  const prefix = locale === 'en' && !prefixDefaultLocale ? '' : `/${locale}`;
  return `${prefix}${suffix}` || '/';
}
