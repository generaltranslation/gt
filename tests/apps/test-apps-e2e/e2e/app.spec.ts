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
    case 'vue-spa':
      await testVueSpa(page);
      break;
    case 'vue-ssr':
      await testVueSsr(page, request);
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

async function testVueSpa(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Hello,\s*Ada\s*!/ })
  ).toBeVisible();
  await expect(
    page.getByText('This sentence comes from useGT().')
  ).toBeVisible();
  await expect(
    page.getByText('This sentence comes from module-level t().')
  ).toBeVisible();
  await expect(
    page.getByText('Local re-exports also work with module-level t().')
  ).toBeVisible();
  await expect(
    page.getByText('Namespace calls also work with module-level t().')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Local re-exports work in TSX' })
  ).toBeVisible();
  await expect(
    page.getByText('Namespace components work in TSX.')
  ).toBeVisible();
  await expect(
    page.getByText('Translator forwarding works in TSX.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Français' }).click();
  await expect(
    page.getByRole('heading', { name: /Bonjour,\s*Ada\s*!/ })
  ).toBeVisible();
  await expect(
    page.getByText('Cette phrase provient de useGT().')
  ).toBeVisible();
  await expect(
    page.getByText('Cette phrase provient de t() au niveau du module.')
  ).toBeVisible();
  await expect(
    page.getByText(
      'Les réexportations locales fonctionnent aussi avec t() au niveau du module.'
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      'Les appels d’espace de noms fonctionnent aussi avec t() au niveau du module.'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Les réexportations locales fonctionnent en TSX',
    })
  ).toBeVisible();
  await expect(
    page.getByText('Les composants avec espace de noms fonctionnent en TSX.')
  ).toBeVisible();
  await expect(
    page.getByText('Le transfert du traducteur fonctionne en TSX.')
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  await page.getByRole('button', { name: 'English' }).click();
  await expect(
    page.getByRole('heading', { name: /Hello,\s*Ada\s*!/ })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Local re-exports work in TSX' })
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.evaluate(() => {
    document.cookie = 'generaltranslation.locale=es;path=/';
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByText('This sentence comes from module-level t().')
  ).toBeVisible();
  const localeCookie = (await page.context().cookies()).find(
    ({ name }) => name === 'generaltranslation.locale'
  );
  expect(localeCookie?.value).toBe('en');
}

async function testVueSsr(page: Page, request: APIRequestContext) {
  const serverResponse = await request.get('/fr/reference');
  expect(serverResponse.ok()).toBe(true);
  const serverHtml = await serverResponse.text();
  expect(serverHtml).toContain('<html lang="fr"');
  expect(serverHtml).toContain('Référence de l’API');
  expect(serverHtml).toContain('Opérations disponibles');
  expect(serverHtml).toContain(
    'Les réexportations locales fonctionnent en TSX'
  );
  expect(serverHtml).toContain(
    'Les composants avec espace de noms fonctionnent en TSX.'
  );
  expect(serverHtml).toContain('Le transfert du traducteur fonctionne en TSX.');

  const isolatedResponses = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      request.get(index % 2 === 0 ? '/reference' : '/fr/reference')
    )
  );
  for (const [index, response] of isolatedResponses.entries()) {
    const html = await response.text();
    if (index % 2 === 0) {
      expect(html).toContain('Available operations');
      expect(html).toContain('Local re-exports work in TSX');
      expect(html).not.toContain('Opérations disponibles');
      expect(html).not.toContain(
        'Les réexportations locales fonctionnent en TSX'
      );
    } else {
      expect(html).toContain('Opérations disponibles');
      expect(html).toContain('Les réexportations locales fonctionnent en TSX');
      expect(html).not.toContain('Available operations');
      expect(html).not.toContain('Local re-exports work in TSX');
    }
  }

  await page.goto('/fr/reference');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { name: 'Opérations disponibles' })
  ).toBeVisible();
  await expect(page.getByText('12 opérations documentées')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Les réexportations locales fonctionnent en TSX',
    })
  ).toBeVisible();
  await expect(
    page.getByText('Les composants avec espace de noms fonctionnent en TSX.')
  ).toBeVisible();
  await expect(
    page.getByText('Le transfert du traducteur fonctionne en TSX.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir la recherche' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Recherche dans la documentation',
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', {
      name: 'Rechercher dans la documentation',
    })
  ).toBeVisible();
  await expect(dialog.getByText('Aucun résultat pour le moment')).toBeVisible();
  await dialog
    .getByPlaceholder('Rechercher dans toute la documentation')
    .fill('launch');
  await expect(dialog.getByText('2 résultats')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer la recherche' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Masquer les liens rapides' }).click();
  await expect(
    page.getByRole('button', { name: 'Afficher les liens rapides' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Copier le lien de la page' }).click();
  await expect(page.getByText('Le lien de la page a été copié.')).toBeVisible();

  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/reference$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'Available operations' })
  ).toBeVisible();
  await expect(page.getByText('12 documented operations')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Local re-exports work in TSX' })
  ).toBeVisible();
  await expect(
    page.getByText('Namespace components work in TSX.')
  ).toBeVisible();
  await expect(
    page.getByText('Translator forwarding works in TSX.')
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/fr\/reference$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(
    page.getByRole('heading', { name: 'Opérations disponibles' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Les réexportations locales fonctionnent en TSX',
    })
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { name: 'Opérations disponibles' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Les réexportations locales fonctionnent en TSX',
    })
  ).toBeVisible();
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
