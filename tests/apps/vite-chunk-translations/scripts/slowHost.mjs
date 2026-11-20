// A host that is slow, for scripts/check.mjs and scripts/check-module.mjs:
// the files a page starts with arrive at once, and every other file of
// translations takes longer than the app waits for one. The page imports the
// application root, which renders the Orders route, which opens its panel:
// three imports, each started by the code of the one before, and each with
// files that are late. The page waits once and shows the source text of what
// those files hold. When they arrive, what is on screen shows their
// translations, with no reload and no navigation, as
// scripts/lateTranslations.mjs checks of one file.

// How much longer than the wait a file takes
const LATE_MS = 2000;

/**
 * @param open Opens the app, as the scripts do.
 * @param check Reports a check, as the scripts do.
 * @param url Where the build is served.
 * @param prompt The paths of the files that arrive at once: those the page starts with.
 * @param isTranslationsFile Whether a path is of a file of translations.
 * @param timeout How long the app waits for a file.
 * @param sources What the elements show whose messages the late files hold, each by its `data-test`.
 * @param expected What they show once the files have arrived.
 */
export async function checkSlowHost({
  open,
  check,
  url,
  prompt,
  isTranslationsFile,
  timeout,
  sources,
  expected,
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
  const wrong = async (elements) => {
    const differing = [];
    for (const [element, text] of Object.entries(elements)) {
      const found = await app.text(element);
      if (found !== text) differing.push(`${element}: "${found}" != "${text}"`);
    }
    return differing.join('; ');
  };
  const late = await wrong(sources);
  let loads = 0;
  app.page.on('load', () => loads++);
  await app.page.evaluate(() => {
    document.querySelector('[data-route]').dataset.kept = 'true';
  });
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
    `${name}: what the late files hold renders the source text`,
    !late,
    late
  );
  const isLate = (warning) => warning.includes('did not load within');
  const waited = app.warnings.length;
  check(
    `${name}: warns of the files it waited for`,
    waited > 0 && app.warnings.every(isLate),
    app.warnings.join(' | ').slice(0, 200)
  );
  // The files that were not waited for are read when they arrive, and the
  // messages on screen are rendered again
  await app.page
    .waitForFunction(
      (expected) =>
        Object.entries(expected).every(
          ([element, text]) =>
            document.querySelector(`[data-test="${element}"]`)?.textContent ===
            text
        ),
      expected,
      { timeout: 2 * (timeout + LATE_MS) }
    )
    .catch(() => {});
  const arrived = await wrong(expected);
  check(
    `${name}: what is on screen shows the translations once the files arrive`,
    !arrived,
    arrived
  );
  const kept = await app.page.evaluate(
    () => document.querySelector('[data-route]').dataset.kept === 'true'
  );
  check(
    `${name}: without a reload, in the elements that were on screen`,
    loads === 0 && kept,
    `${loads} loads`
  );
  check(
    `${name}: warns of the files it did not wait for, which are late too`,
    app.warnings.length > waited && app.warnings.every(isLate),
    `${waited} waited for, ${app.warnings.length - waited} not, ${held.length} files`
  );
  await app.close();
}
