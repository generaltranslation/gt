// What scripts/check.mjs and scripts/check-module.mjs check a file with that
// arrives after its messages rendered: the page waits SHORT_TIMEOUT_MS for a
// file, and the check holds one back until the app has rendered without it.
// When the file arrives, what is on screen shows its translations, with no
// reload and no navigation. A `<T>` and the functions of useGT() and
// useMessages() look their translations up again. A component that calls
// the exported `t` as it renders reads it again when it renders again, as
// everything under the application root does when the root's useMessages()
// renders the root. What a module read as it was evaluated is a string by
// then and stays the source, and so does what a component above the root
// rendered, which nothing renders again.

/** What a page waits for a file in these checks; gt-react's default is ten seconds. */
export const SHORT_TIMEOUT_MS = 1000;

/**
 * What `open()` prepares a page with so that it waits SHORT_TIMEOUT_MS for a
 * file, and `path` is held back until `release()`.
 */
export function holdBack(path) {
  let release;
  const released = new Promise((resolve) => (release = resolve));
  const prepare = async (page) => {
    // The startup script assigns what it leaves, which gt-react reads the
    // wait from
    await page.addInitScript((wait) => {
      let state;
      Object.defineProperty(window, '__GT_CHUNK_TRANSLATIONS__', {
        configurable: true,
        get: () => state,
        set(value) {
          state = value;
          if (value) value.w = wait;
        },
      });
    }, SHORT_TIMEOUT_MS);
    await page.route(`**${path}`, async (route) => {
      await released;
      await route.continue();
    });
  };
  return { prepare, release };
}

/**
 * Checks that `app`, which rendered without `file`, shows `sources`, each the
 * text of an element by its `data-test`, then lets the file arrive and checks
 * that the elements that were on screen show `expected`.
 * @param check The script's own `check()`.
 */
export async function checkArrival(
  check,
  name,
  app,
  release,
  file,
  sources,
  expected
) {
  const wrong = async (elements) => {
    const differing = [];
    for (const [element, text] of Object.entries(elements)) {
      const shown = await app.text(element);
      if (shown !== text) differing.push(`${element}: "${shown}" != "${text}"`);
    }
    return differing.join('; ');
  };
  let loads = 0;
  app.page.on('load', () => loads++);
  await app.page.evaluate(() => {
    document.querySelector('[data-route]').dataset.kept = 'true';
  });
  const late = await wrong(sources);
  check(
    `${name}: renders the source text of what the file holds, and warns of the file once`,
    !late &&
      app.warnings.length === 1 &&
      app.warnings[0].includes(
        `${file} did not load within ${SHORT_TIMEOUT_MS} ms`
      ),
    [late, ...app.warnings].filter(Boolean).join(' | ').slice(0, 300)
  );
  release();
  await app.page
    .waitForFunction(
      (expected) =>
        Object.entries(expected).every(
          ([element, text]) =>
            document.querySelector(`[data-test="${element}"]`)?.textContent ===
            text
        ),
      expected,
      { timeout: 5000 }
    )
    .catch(() => {});
  const arrived = await wrong(expected);
  check(`${name}: shows its translations once it arrives`, !arrived, arrived);
  const kept = await app.page.evaluate(
    () => document.querySelector('[data-route]').dataset.kept === 'true'
  );
  check(
    `${name}: without a reload, in the elements that were on screen`,
    loads === 0 && kept && app.warnings.length === 1,
    `${loads} loads, ${app.warnings.length} warnings`
  );
}
