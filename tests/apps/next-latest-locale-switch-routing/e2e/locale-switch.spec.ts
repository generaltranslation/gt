import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const prefixDefaultLocale = process.env.GT_PREFIX_DEFAULT_LOCALE === 'true';
const localeSelectorName = 'General Translation locale selector';
const content = {
  'en-us': 'American English content',
  'en-gb': 'British English content',
  'fr-fr': 'Contenu français',
  'de-de': 'Deutscher Inhalt',
} as const;

for (const route of [
  { name: 'root', suffix: '' },
  { name: 'nested', suffix: '/nested' },
] as const) {
  test(`${route.name}: default to nondefault to default, then prefixed to prefixed`, async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(route.suffix || '/');

    await expectLocale(page, 'en-us', route.name, route.suffix);
    await selectLocale(page, 'fr-fr');
    await expectLocale(page, 'fr-fr', route.name, route.suffix);
    await selectLocale(page, 'en-us');
    await expectLocale(page, 'en-us', route.name, route.suffix);
    await selectLocale(page, 'fr-fr');
    await expectLocale(page, 'fr-fr', route.name, route.suffix);
    await selectLocale(page, 'de-de');
    await expectLocale(page, 'de-de', route.name, route.suffix);
  });
}

test('rejected lowercase alias reconciles without reloading the document', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(pathFor('en-us', '/restricted'));

  await expectLocale(page, 'en-us', 'restricted', '/restricted');
  const initialRenderId = await page
    .getByTestId('server-render-id')
    .textContent();
  const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  const stateInput = page.getByRole('textbox', { name: 'Client state' });
  await stateInput.fill('preserved across refresh');

  await selectLocale(page, 'en-gb');

  await expect
    .poll(() => page.getByTestId('server-render-id').textContent())
    .not.toBe(initialRenderId);
  await expectLocale(page, 'en-us', 'restricted', '/restricted');
  await expect(stateInput).toHaveValue('preserved across refresh');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    initialTimeOrigin
  );
});

async function selectLocale(page: Page, locale: keyof typeof content) {
  await page
    .getByRole('combobox', { name: localeSelectorName })
    .selectOption(locale);
}

async function expectLocale(
  page: Page,
  locale: keyof typeof content,
  route: 'root' | 'nested' | 'restricted',
  suffix: '' | '/nested' | '/restricted'
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

function pathFor(
  locale: keyof typeof content,
  suffix: '' | '/nested' | '/restricted'
) {
  const prefix = locale === 'en-us' && !prefixDefaultLocale ? '' : `/${locale}`;
  return `${prefix}${suffix}` || '/';
}
