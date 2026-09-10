import { readFileSync } from 'node:fs';
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

const settings = JSON.parse(readFileSync('regression-config.json', 'utf8'));
const origin = `http://localhost:${settings.port}`;
const slash = settings.trailingSlash ? '/' : '';
type Payload = {
  route: string;
  params: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  localeHeader: string | null;
};
type Expected = Pick<Payload, 'route' | 'params'>;
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }, info) => {
  await info.attach('browser-state', {
    body: JSON.stringify({ url: page.url(), errors: browserErrors.get(page) }),
    contentType: 'application/json',
  });
  expect(browserErrors.get(page)).toEqual([]);
});

function url(path: string, scenario: string, prefix = '1', next?: string) {
  const query = new URLSearchParams({ scenario, prefix });
  query.append('tag', 'a');
  query.append('tag', 'b');
  if (next) query.set('next', next);
  return `${origin}${path}?${query}`;
}

function payloadFromHtml(body: string): Payload | null {
  const value = body.match(/<pre id="route-result">([\s\S]*?)<\/pre>/)?.[1];
  return value
    ? JSON.parse(
        value
          .replaceAll('&quot;', '"')
          .replaceAll('&#x27;', "'")
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&amp;', '&')
      )
    : null;
}

/** Keep loop evidence bounded and preserve the actual wrong page on failures. */
async function follow(
  request: APIRequestContext,
  start: string,
  info: TestInfo
) {
  const chain: {
    url: string;
    status: number;
    headers: Record<string, string>;
    payload: Payload | null;
  }[] = [];
  const visited = new Set<string>();
  let current = start;
  try {
    for (let hop = 0; hop <= 5; hop++) {
      expect(
        new URL(current).origin,
        'redirect must stay on the reported localhost origin'
      ).toBe(origin);
      expect(
        visited.has(current),
        `redirect loop: ${JSON.stringify(chain)}`
      ).toBe(false);
      visited.add(current);
      const response = await request.get(current, { maxRedirects: 0 });
      const headers = response.headers();
      const entry = {
        url: current,
        status: response.status(),
        headers,
        payload: payloadFromHtml(await response.text()),
      };
      chain.push(entry);
      if (
        [301, 302, 303, 307, 308].includes(entry.status) &&
        headers.location
      ) {
        current = new URL(headers.location, current).href;
      } else {
        return entry;
      }
    }
    throw new Error(`Redirect cap exceeded: ${JSON.stringify(chain)}`);
  } finally {
    await info.attach('http-chain', {
      body: JSON.stringify(chain, null, 2),
      contentType: 'application/json',
    });
  }
}

function expectPayload(payload: Payload | null, expected: Expected) {
  expect(payload).toMatchObject({
    ...expected,
    query: { tag: ['a', 'b'] },
    localeHeader: expected.params.locale,
  });
}

async function checkPage(page: Page, expected: Expected) {
  await expect
    .poll(async () => {
      const text = await page.locator('#route-result').textContent();
      return text ? JSON.parse(text) : null;
    })
    .toMatchObject({
      ...expected,
      query: { tag: ['a', 'b'] },
      localeHeader: expected.params.locale,
    });
}

async function navigate(
  page: Page,
  start: string,
  first: Expected,
  second: Expected
) {
  await page.goto(start);
  await checkPage(page, first);
  await page.getByRole('link', { name: 'Next route', exact: true }).click();
  await checkPage(page, second);
  await page.reload();
  await checkPage(page, second);
  await page.goBack();
  await checkPage(page, first);
  await page.goForward();
  await checkPage(page, second);
}

test.describe('encoded', () => {
  test.skip(!settings.features.includes('encoded'), 'Feature subset');
  for (const prefix of ['0', '1'])
    for (const category of ['%66r', 'f%72']) {
      test(`encoded category ${category}, prefix ${prefix}`, async ({
        page,
        request,
      }, info) => {
        const start = url(
          `/fr/${category}/articles/a${slash}`,
          'encoded',
          prefix,
          `/fr/news/articles/b${slash}`
        );
        const expected = {
          route: 'category-article',
          params: { locale: 'fr', category: 'fr', id: 'a' },
        };
        const response = await follow(request, start, info);
        expect(response.status).toBe(200);
        expectPayload(response.payload, expected);
        expect(response.url).toBe(start);
        await navigate(page, start, expected, {
          route: 'category-article',
          params: { locale: 'fr', category: 'news', id: 'b' },
        });
      });
    }
});

test.describe('ownership', () => {
  test.skip(!settings.features.includes('ownership'), 'Feature subset');
  test('locale root is not the locale-named shared page', async ({
    page,
    request,
  }, info) => {
    const start = url(`/fr${slash}`, 'home');
    const response = await follow(request, start, info);
    const expected = { route: 'locale-home', params: { locale: 'fr' } };
    expect(response.status).toBe(200);
    expect(response.url).toBe(start);
    expectPayload(response.payload, expected);
    await page.goto(start);
    await checkPage(page, expected);
    await page.reload();
    await checkPage(page, expected);
  });
  for (const scenario of ['dynamic', 'reverse']) {
    test(`dynamic ownership in ${scenario} order`, async ({
      page,
      request,
    }, info) => {
      const start = url(
        `/fr/hello${slash}`,
        scenario,
        '1',
        `/fr/world${slash}`
      );
      const expected = {
        route: 'root-dynamic',
        params: { locale: 'fr', category: 'hello' },
      };
      const response = await follow(request, start, info);
      expect(response.status).toBe(200);
      expect(response.url).toBe(start);
      expectPayload(response.payload, expected);
      await navigate(page, start, expected, {
        route: 'root-dynamic',
        params: { locale: 'fr', category: 'world' },
      });
    });
  }
});

test.describe('depth', () => {
  test.skip(!settings.features.includes('depth'), 'Feature subset');
  for (const source of ['/fr/short/alpha/beta', '/fr/long/static/alpha/beta']) {
    test(`source template preserves params from ${source}`, async ({
      page,
      request,
    }, info) => {
      const start = url(
        source + slash,
        'depth',
        '1',
        `/fr/long/static/next/value${slash}`
      );
      const response = await follow(request, start, info);
      const expected = {
        route: 'short',
        params: { locale: 'fr', a: 'alpha', b: 'beta' },
      };
      expect(response.status).toBe(200);
      expect(new URL(response.url).pathname).toBe(
        `/fr/long/static/alpha/beta${slash}`
      );
      expectPayload(response.payload, expected);
      await navigate(page, start, expected, {
        route: 'short',
        params: { locale: 'fr', a: 'next', b: 'value' },
      });
    });
  }
  for (const value of ['a%2Fb', 'a%252Fb']) {
    test(`preserves raw parameter bytes ${value}`, async ({
      page,
      request,
    }, info) => {
      // Native control avoids assuming every Next version decodes params alike.
      const control = await follow(
        request,
        url(`/fr/short/${value}/beta${slash}`, 'native'),
        info
      );
      expect(control.status).toBe(200);
      const start = url(`/fr/short/${value}/beta${slash}`, 'depth');
      const response = await follow(request, start, info);
      expect(response.status).toBe(200);
      expect(new URL(response.url).pathname).toBe(
        `/fr/long/static/${value}/beta${slash}`
      );
      const expected = { route: 'short', params: control.payload!.params };
      expectPayload(response.payload, expected);
      await page.goto(start);
      await checkPage(page, expected);
      await page.reload();
      await checkPage(page, expected);
    });
  }
  test('unprefixed default alias uses its source template', async ({
    page,
    request,
  }, info) => {
    const start = url(`/long/static/alpha/beta${slash}`, 'unprefixed', '0');
    const expected = {
      route: 'short',
      params: { locale: 'en', a: 'alpha', b: 'beta' },
    };
    const response = await follow(request, start, info);
    expect(response.status).toBe(200);
    expect(response.url).toBe(start);
    expectPayload(response.payload, expected);
    await page.goto(start);
    await checkPage(page, expected);
  });
  test('locale reset keeps source params and the selected locale cookie', async ({
    context,
    page,
  }, info) => {
    await context.addCookies([
      { name: 'generaltranslation.locale', value: 'en', url: origin },
      { name: 'generaltranslation.locale-reset', value: 'true', url: origin },
    ]);
    const response = await follow(
      context.request,
      url(`/fr/long/static/alpha/beta${slash}`, 'depth'),
      info
    );
    const expected = {
      route: 'short',
      params: { locale: 'en', a: 'alpha', b: 'beta' },
    };
    expect(response.status).toBe(200);
    expect(new URL(response.url).pathname).toBe(`/en/short/alpha/beta${slash}`);
    expectPayload(response.payload, expected);
    const cookies = await context.cookies();
    expect(
      cookies.find((cookie) => cookie.name === 'generaltranslation.locale')
        ?.value
    ).toBe('en');
    expect(
      cookies.some(
        (cookie) => cookie.name === 'generaltranslation.locale-reset'
      )
    ).toBe(false);
    await page.goto(response.url);
    await checkPage(page, expected);
    await page.reload();
    await checkPage(page, expected);
  });
});

test.describe('catchall', () => {
  test.skip(!settings.features.includes('catchall'), 'Feature subset');
  for (const ending of ['/', '//']) {
    test(`required catchall with ${ending.length} trailing slash(es)`, async ({
      page,
      request,
    }, info) => {
      const start = url(
        `/fr/catalogue/science/one${ending}`,
        'catchall',
        '1',
        '/fr/catalogue/science/one/two/'
      );
      const response = await follow(request, start, info);
      const expected = {
        route: 'catalog',
        params: { locale: 'fr', category: 'science', slug: ['one'] },
      };
      expect(response.status).toBe(200);
      expect(new URL(response.url).pathname).toBe('/fr/catalogue/science/one/');
      expectPayload(response.payload, expected);
      await navigate(page, start, expected, {
        route: 'catalog',
        params: { locale: 'fr', category: 'science', slug: ['one', 'two'] },
      });
      const missing = await follow(
        request,
        url('/fr/catalog/science/', 'catchall'),
        info
      );
      expect(missing.status).toBe(404);
    });
  }
});
