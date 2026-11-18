import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { getApp } from '../apps.mjs';
import { expect, test } from './fixtures';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
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
    case 'vue-spa':
      await testVueSpa(page);
      break;
    case 'sveltekit':
      await testSvelteKitApp(page, request);
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

async function testSvelteKitApp(page: Page, request: APIRequestContext) {
  const french = await loadSvelteKitTranslations('fr');
  const heading = page.getByRole('heading', { level: 1 });
  const counter = page.getByTestId('counter');

  const serverHtml = await (
    await request.get('/', {
      headers: { cookie: 'generaltranslation.locale=fr' },
    })
  ).text();
  expect(serverHtml).toContain(french.string('Welcome to the Svelte test app'));

  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: 'generaltranslation.locale', value: 'fr', url: app.baseURL },
    ]);
  await page.goto('/');
  await expect(heading).toHaveText(
    french.string('Welcome to the Svelte test app')
  );
  await expect(page.getByTestId('greeting')).toHaveText(
    french.rich('Hello ', {
      _gt_value_2: 'Ada',
      _gt_n_3: new Intl.NumberFormat(['fr', 'en']).format(1234),
    })
  );

  await counter.getByRole('button').click();
  await expect(counter).toHaveText(
    french.rich('You clicked ', { _gt_value_2: '1' })
  );

  await page.getByRole('button', { name: 'English' }).click();
  await expect(heading).toHaveText('Welcome to the Svelte test app');
  await expect(page.getByTestId('greeting')).toHaveText(
    'Hello Ada, you have 1,234 new messages.'
  );
  await expect(counter).toHaveText('You clicked this button 1 times.');

  await page.getByRole('button', { name: 'Français' }).click();
  await page
    .getByRole('link', { name: french.string('About this app') })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(heading).toHaveText(french.string('About'));
  await expect(page.getByTestId('about')).toHaveText(
    french.rich('This page was reached by ', {})
  );
}

type SvelteKitEntry = {
  dataFormat: 'JSX' | 'STRING';
  source: unknown;
  metadata: { hash: string };
};

/** Looks up the committed catalog through the manifest the app build wrote. */
async function loadSvelteKitTranslations(locale: string) {
  const appDir = path.resolve(packageDir, '../sveltekit');
  const read = async (file: string) =>
    JSON.parse(await readFile(path.join(appDir, file), 'utf8'));
  const manifest: SvelteKitEntry[] = await read('.gt/inline-manifest.json');
  const catalog: Record<string, unknown> = await read(`src/_gt/${locale}.json`);
  const translation = (matches: (entry: SvelteKitEntry) => boolean) => {
    const entry = manifest.find(matches);
    const value = entry && catalog[entry.metadata.hash];
    if (value === undefined) {
      throw new Error(`The ${locale} catalog lacks a manifest entry`);
    }
    return value;
  };
  return {
    string: (source: string) =>
      translation(
        (entry) => entry.dataFormat === 'STRING' && entry.source === source
      ) as string,
    rich: (sourceStart: string, variables: Record<string, string>) =>
      textOf(
        translation(
          (entry) =>
            entry.dataFormat === 'JSX' &&
            Array.isArray(entry.source) &&
            entry.source[0] === sourceStart
        ),
        variables
      ),
  };
}

function textOf(children: unknown, variables: Record<string, string>): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map((child) => textOf(child, variables)).join('');
  }
  if (children && typeof children === 'object') {
    const node = children as { k?: string; c?: unknown };
    return node.k !== undefined
      ? (variables[node.k] ?? '')
      : textOf(node.c, variables);
  }
  return '';
}

async function testVueSpa(page: Page) {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'generaltranslation.locale',
      value: 'fr',
      url: app.baseURL,
    },
  ]);

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Traduction de module chargée après l’initialisation de la SPA.',
    })
  ).toBeVisible();
  await expect(
    page.getByText('La traduction du composant partage l’exécution SPA.')
  ).toBeVisible();
  await expect(page.getByText('Locale: fr')).toBeVisible();
  await expect(page.getByText('Module evaluations: 1')).toBeVisible();
  await expect(page.getByText('Bootstrap: ready')).toBeVisible();

  await selectLocale(page, 'en');
  await expect(
    page.getByRole('heading', {
      name: 'Module translation loaded after SPA initialization.',
    })
  ).toBeVisible();
  await expect(
    page.getByText('Component translation shares the SPA runtime.')
  ).toBeVisible();
  await expect(page.getByText('Locale: en')).toBeVisible();
  await expect(page.getByText('Module evaluations: 2')).toBeVisible();

  await page.evaluate(() => {
    document.cookie = 'generaltranslation.locale=es;path=/';
  });
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Module translation loaded after SPA initialization.',
    })
  ).toBeVisible();
  await expect(
    page.getByText('Component translation shares the SPA runtime.')
  ).toBeVisible();
  await expect(page.getByText('Locale: en')).toBeVisible();
  await expect(page.getByText('Module evaluations: 3')).toBeVisible();
  const localeCookie = (await page.context().cookies()).find(
    ({ name }) => name === 'generaltranslation.locale'
  );
  expect(localeCookie?.value).toBe('en');
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Client locale: en')).toBeVisible();
  await expect(page.getByText('NEXT_LOCALE preference: unset')).toBeVisible();

  await selectLocale(page, 'fr');
  await expect(page).toHaveURL(/\/fr\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByText('Client locale: fr')).toBeVisible();
  await expect(page.getByText('NEXT_LOCALE preference: fr')).toBeVisible();
  await expectPagesLocaleCookie(page, 'fr');
  await expect(
    page.getByText('Une chaîne traduite avec useGT de gt-next.')
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/fr\/?$/);
  await expect(page.getByText('NEXT_LOCALE preference: fr')).toBeVisible();

  await selectLocale(page, 'zh');
  await expect(page).toHaveURL(/\/zh\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.getByText('Client locale: zh')).toBeVisible();
  await expectPagesLocaleCookie(page, 'zh');
  await expect(
    page.getByText('用 gt-next 的 useGT 翻译的字符串。')
  ).toBeVisible();

  await selectLocale(page, 'en');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Client locale: en')).toBeVisible();
  await expectPagesLocaleCookie(page, 'en');
}

async function expectPagesLocaleCookie(page: Page, locale: string) {
  const cookies = await page.context().cookies();
  expect(cookies.find(({ name }) => name === 'NEXT_LOCALE')?.value).toBe(
    locale
  );
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
