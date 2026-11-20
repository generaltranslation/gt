// A host that is slow, for scripts/check.mjs and scripts/check-module.mjs:
// the files a page starts with arrive at once, and every other file of
// translations takes longer than the app waits for one. The page imports the
// application root, which renders the Orders route, which opens its panel:
// three imports, each started by the code of the one before, and each with
// files that are late.

// How much longer than the wait a file takes
const LATE_MS = 2000;

/**
 * @param open Opens the app, as the scripts do.
 * @param check Reports a check, as the scripts do.
 * @param url Where the build is served.
 * @param prompt The paths of the files that arrive at once: those the page starts with.
 * @param isTranslationsFile Whether a path is of a file of translations.
 * @param timeout How long the app waits for a file.
 */
export async function checkSlowHost({
  open,
  check,
  url,
  prompt,
  isTranslationsFile,
  timeout,
}) {
  const name = 'a host that is slow';
  const held = [];
  const app = await open(url, 'fr', (page) =>
    page.route(
      ({ pathname }) =>
        isTranslationsFile(pathname) && !prompt.includes(pathname),
      (route) => {
        const path = new URL(route.request().url()).pathname;
        held.push(
          new Promise((resolve) => setTimeout(resolve, timeout + LATE_MS))
            .then(() => route.continue())
            .then(() => path)
        );
      }
    )
  );
  const start = Date.now();
  await app.goto('#orders');
  const shown = Date.now() - start;
  const heading = await app.text('heading');
  await app.page.click('[data-nav="details"]');
  await app.page.waitForSelector('[data-test="details"]');
  const opened = Date.now() - start - shown;
  check(
    `${name}: a route under the application root shows after one wait`,
    shown > timeout - 500 && shown < timeout + 4000,
    `${shown} ms`
  );
  check(
    `${name}: a panel the route opens is not waited for`,
    opened < 2000,
    `${opened} ms`
  );
  check(
    `${name}: what is not waited for renders the source text`,
    heading === 'Recent orders',
    heading
  );
  const count = (text) =>
    app.warnings.filter((warning) => warning.includes(text)).length;
  check(
    `${name}: warns of the files that are late and of those that are not waited for`,
    count('did not load within') > 0 && count('are not waited for') > 0,
    `${count('did not load within')} late, ${count('are not waited for')} not waited for, ${held.length} files`
  );
  // What was late is still read: a route that renders again is translated
  await app.page.waitForFunction(
    (paths) => {
      const arrived = performance
        .getEntriesByType('resource')
        .filter((entry) => entry.responseEnd > 0)
        .map((entry) => new URL(entry.name).pathname);
      return paths.every((path) => arrived.includes(path));
    },
    await Promise.all(held)
  );
  await app.navigate('home');
  await app.navigate('orders');
  const later = await app.text('heading');
  check(
    `${name}: a route that renders once its files have arrived is translated`,
    later === 'RECENT ORDERS',
    later
  );
  await app.close();
}
