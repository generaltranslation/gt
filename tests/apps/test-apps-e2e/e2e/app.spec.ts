import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { getApp } from '../apps.mjs';
import { expect, test } from './fixtures';

const appName = process.env.GT_TEST_APP;
const app = getApp(appName);
const localeSelectorName = 'General Translation locale selector';

test(`${appName} renders local translations and switches locales`, async ({
  page,
  request,
  browser,
}) => {
  switch (app.kind) {
    case 'react':
      await testReactApp(page);
      break;
    case 'next':
      await testNextApp(page);
      break;
    case 'next-dictionary':
      await testDictionaryApp(page);
      break;
    case 'next-routing':
      await testRoutingApp(page);
      break;
    case 'next-routing-cache':
      await testRoutingApp(page, true);
      break;
    case 'next-pages':
      await testPagesApp(page);
      break;
    case 'tanstack':
      await testTanStackApp(page);
      break;
    case 'node':
      await testNodeApp(browser, request);
      break;
    default:
      throw new Error(`Unsupported app kind: ${app.kind}`);
  }
});

async function testReactApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Locale: en')).toBeVisible();
  await expect(page.getByText('A string translated with useGT.')).toBeVisible();

  await selectLocale(page, 'fr');
  await expect(page.getByText('Locale: fr')).toBeVisible();
  await expect(
    page.getByText('Une chaîne traduite à l’aide de useGT.')
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Locale: fr')).toBeVisible();

  await selectLocale(page, 'zh');
  await expect(page.getByText('Locale: zh')).toBeVisible();
  await expect(page.getByText('使用 useGT 翻译的文本。')).toBeVisible();

  await selectLocale(page, 'en');
  await expect(page.getByText('Locale: en')).toBeVisible();
  await expect(page.getByText('A string translated with useGT.')).toBeVisible();
}

async function testNextApp(page: Page) {
  await page.goto('/');
  await expectNextLocale(page, 'en');
  await expect(
    page.getByText('A server-translated string from getGT.')
  ).toBeVisible();
  await expect(
    page.getByText('A client-translated string from useGT.')
  ).toBeVisible();

  await selectLocale(page, 'fr');
  await expectNextLocale(page, 'fr');
  await expect(
    page.getByText('Une chaîne traduite côté serveur avec getGT.')
  ).toBeVisible();
  await expect(
    page.getByText('Une chaîne traduite côté client avec useGT.')
  ).toBeVisible();
  await page.reload();
  await expectNextLocale(page, 'fr');

  await selectLocale(page, 'zh');
  await expectNextLocale(page, 'zh');
  await expect(page.getByText('来自 getGT 的服务器端译文。')).toBeVisible();
  await expect(page.getByText('来自 useGT 的客户端译文。')).toBeVisible();

  await selectLocale(page, 'en');
  await expectNextLocale(page, 'en');
}

async function testDictionaryApp(page: Page) {
  await page.goto('/');
  await expectNextLocale(page, 'en');
  await expect(
    page.getByRole('heading', { name: 'gt-next dictionary test' })
  ).toBeVisible();
  await expect(
    page.getByText('Hello Ada, this came from a client dictionary lookup.')
  ).toBeVisible();

  await selectLocale(page, 'fr');
  await expectNextLocale(page, 'fr');
  await expect(
    page.getByRole('heading', { name: 'Test de dictionnaire gt-next' })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Bonjour Ada, ce texte vient d'une recherche dans le dictionnaire client."
    )
  ).toBeVisible();
  await page.reload();
  await expectNextLocale(page, 'fr');

  await selectLocale(page, 'zh');
  await expectNextLocale(page, 'zh');
  await expect(
    page.getByRole('heading', { name: 'gt-next dictionary test' })
  ).toBeVisible();

  await selectLocale(page, 'en');
  await expectNextLocale(page, 'en');
}

async function testRoutingApp(page: Page, cacheComponents = false) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expectNextLocale(page, 'en');

  await page.goto('/fr');
  await expect(page).toHaveURL(/\/fr\/?$/);
  await expectNextLocale(page, 'fr');
  await expect(
    page.getByText(
      cacheComponents
        ? 'A server-translated string from a cached component.'
        : 'Une chaîne traduite côté serveur avec getGT.'
    )
  ).toBeVisible();

  await selectLocale(page, 'zh');
  await expect(page).toHaveURL(/\/zh\/?$/);
  await expectNextLocale(page, 'zh');
  await expect(page.getByText('来自 useGT 的客户端译文。')).toBeVisible();
  await page.reload();
  await expectNextLocale(page, 'zh');

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expectNextLocale(page, 'en');
  await page.goForward();
  await expect(page).toHaveURL(/\/zh\/?$/);
  await expectNextLocale(page, 'zh');

  await selectLocale(page, 'en');
  await expect(page).toHaveURL(/\/$/);
  await expectNextLocale(page, 'en');
}

async function testPagesApp(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Client locale: en')).toBeVisible();
  await expect(page.getByText('Cookie locale (SSR): en')).toBeVisible();

  await selectLocale(page, 'fr');
  await expect(page.getByText('Client locale: fr')).toBeVisible();
  await expect(
    page.getByText('Une chaîne traduite avec useGT de gt-next.')
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Cookie locale (SSR): fr')).toBeVisible();

  await selectLocale(page, 'zh');
  await expect(page.getByText('Client locale: zh')).toBeVisible();
  await expect(
    page.getByText('用 gt-next 的 useGT 翻译的字符串。')
  ).toBeVisible();

  await selectLocale(page, 'en');
  await expect(page.getByText('Client locale: en')).toBeVisible();
}

async function testTanStackApp(page: Page) {
  const routes = [
    {
      path: '/ssr',
      locale: 'fr',
      translation: 'Bonjour depuis le fournisseur racine.',
    },
    {
      path: '/spa',
      locale: 'zh',
      translation: '来自根级 Provider 的问候。',
    },
    {
      path: '/data-only',
      locale: 'fr',
      translation: 'Bonjour depuis le fournisseur racine.',
    },
  ];

  await page.context().clearCookies();
  let currentLocale = 'en';

  for (const route of routes) {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    await expectTanStackLocale(page, currentLocale);

    await selectLocale(page, route.locale);
    await expectTanStackLocale(page, route.locale);
    await expect(page.getByText(route.translation)).toBeVisible();
    await page.reload();
    await expectTanStackLocale(page, route.locale);
    currentLocale = route.locale;
  }
}

async function testNodeApp(browser: Browser, request: APIRequestContext) {
  for (const locale of ['en', 'fr', 'zh']) {
    const headers = { 'Accept-Language': locale };
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    const documentResponse = await page.goto('/');
    expect(documentResponse?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(
      page.getByRole('heading', { name: 'Hello, world!' })
    ).toBeVisible();

    const greeting = await request.get('/api/greeting', { headers });
    expect(greeting.ok()).toBe(true);
    expect(await greeting.json()).toMatchObject({
      locale,
      message: 'Hello, world!',
    });

    const status = await request.get('/api/status', { headers });
    expect(status.ok()).toBe(true);
    expect(await status.json()).toMatchObject({ locale });

    const missing = await request.get('/missing', { headers });
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toMatchObject({ locale });

    await context.close();
  }
}

async function selectLocale(page: Page, locale: string) {
  await page
    .getByRole('combobox', { name: localeSelectorName })
    .selectOption(locale);
}

async function expectNextLocale(page: Page, locale: string) {
  await expect(page.getByText(`Server locale: ${locale}`)).toBeVisible();
  await expect(page.getByText(`Client locale: ${locale}`)).toBeVisible();
}

async function expectTanStackLocale(page: Page, locale: string) {
  const localePanel = page.locator('.panel').filter({
    has: page.getByText('Provider locale', { exact: true }),
  });
  await expect(localePanel.locator('.value')).toHaveText(locale);
}
