// What the browser checks of the TanStack Start apps share: how a check is
// reported, and a page that records every text each message ever shows.
//
// Every message of an app is in an element with `data-m`, whose `data-src`
// is what the source locale renders. An observer that is installed before any
// script of the page records each element that ever shows anything else,
// which is how a flash of source text is caught.

/**
 * What the pages and requests of a check say they are. TanStack Start sends
 * a client it takes for a crawler, as headless Chromium by its own name, the
 * whole page at once: only a browser gets a page in parts, with what is
 * deferred after the rest.
 */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Prints one line per check; `finish()` exits with 1 when any failed. */
export function createReporter() {
  let failed = 0;
  return {
    check(title, passed, details) {
      if (!passed) failed++;
      console.log(
        `${passed ? 'ok  ' : 'FAIL'} ${title}${passed || !details ? '' : `\n     ${JSON.stringify(details)}`}`
      );
    },
    finish() {
      console.log(failed ? `\n${failed} failed` : '\nall passed');
      process.exit(failed ? 1 : 0);
    },
  };
}

/**
 * @param routes What marks the page of each route, in its `data-page`.
 * @param expected What a message with a source text shows in a locale.
 * @param settled Waits for what a route renders after it has hydrated, when it does.
 */
export function createOpen({ browser, routes, expected, settled }) {
  /**
   * Opens a page for a visitor whose cookie asks for `locale`, or who has no
   * cookie when it is undefined. `renders` is the locale the pages are
   * expected in, when not that one.
   */
  return async function open(origin, locale, renders = locale) {
    const context = await browser.newContext({
      locale: 'en-US',
      userAgent: USER_AGENT,
    });
    if (locale !== undefined) {
      await context.addCookies([
        { name: 'generaltranslation.locale', value: locale, url: origin },
      ]);
    }
    // Before any script of the page: what every message ever shows
    await context.addInitScript(() => {
      window.__shown = [];
      const look = () => {
        for (const element of document.querySelectorAll('[data-m]')) {
          const text = element.textContent;
          // An element whose source is server data has none until it arrives
          if (!element.hasAttribute('data-src')) continue;
          if (text !== '' && element.__last !== text) {
            element.__last = text;
            window.__shown.push([element.getAttribute('data-src'), text]);
          }
        }
      };
      new MutationObserver(look).observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    const page = await context.newPage();
    const problems = [];
    const requests = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        problems.push(message.text().slice(0, 200));
      }
    });
    page.on('pageerror', (error) => problems.push(error.message.slice(0, 200)));
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      requests.push({ pathname, status: response.status() });
    });
    let rendered = renders;
    const visitor = {
      page,
      requests,
      problems,
      /** The translation files the page has requested since the last call. */
      takeTranslationRequests() {
        return requests
          .splice(0)
          .filter(({ pathname }) => pathname.endsWith('.json'))
          .map(({ pathname, status }) => `${status} ${pathname}`);
      },
      setLocale(next) {
        rendered = next;
      },
      /** Waits for the page of `route`, hydrated and settled. */
      async settle(route) {
        await page.waitForSelector(`[data-page="${routes[route]}"]`);
        await page.waitForFunction(() => {
          const nav = document.querySelector('[data-nav]');
          return (
            !!nav && Object.keys(nav).some((key) => key.startsWith('__react'))
          );
        });
        await page.waitForLoadState('networkidle');
        await settled?.(page, route);
      },
      /** Visits `route`, and resolves to the HTML the server sent for it. */
      async visit(route, path = route) {
        const response = await page.goto(origin + path);
        const html = await response.text();
        await visitor.settle(route);
        return html;
      },
      async navigate(route) {
        await page.click(`[data-link="${route}"]`);
        await visitor.settle(route);
      },
      /**
       * The messages that show another text than their locale's, and unless
       * `nowOnly`, those that ever showed one.
       */
      async wrong(nowOnly = false) {
        const { now, shown } = await page.evaluate(() => ({
          now: [...document.querySelectorAll('[data-m][data-src]')].map(
            (element) => [element.getAttribute('data-src'), element.textContent]
          ),
          shown: window.__shown.splice(0),
        }));
        return {
          count: now.length,
          wrong: [...now, ...(nowOnly ? [] : shown)]
            .filter(([source, text]) => text !== expected(source, rendered))
            .map(([, text]) => text),
        };
      },
      close: () => context.close(),
    };
    return visitor;
  };
}
