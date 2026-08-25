// Replayer e2e: serve the harness + built dist, drive a real Chromium, and assert
// the player's behaviors against e2e/fixture.json (regenerate with `pnpm e2e:fixture`).
// Scenarios: mount/reveal + capture-frame crop, per-locale text overlay (both the
// <T>-hash and gt()-string harvest paths), live locale switching, initialLocale,
// switchLocalesAllowed:false, the events-only embedded-overlay fallback, the
// synthesized cursor, the dark toggle, and debug drag-drop (graceful failure +
// hot-swap). Exits non-zero on any failure.
import { getBrowser, newPage } from './browser.mjs';
import { startServer } from './serve.mjs';

const PORT = 5642;
const BASE = `http://localhost:${PORT}`;

const SOURCE_TEXT = 'Welcome to the fixture';
const ES_T = ['Bienvenido al fixture', 'Ejecutar la demo']; // <T> hash path
const ES_STR = 'Los ajustes y proyectos viven aquí'; // gt()-string path

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(
    `${ok ? '  ✅' : '  ❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`
  );
}

const pageErrors = [];
async function open(browser, query) {
  const page = await newPage(browser);
  page.on('pageerror', (e) =>
    pageErrors.push(`${query || '/'}: ${String(e).slice(0, 160)}`)
  );
  // Real device metrics (page.setViewportSize is a no-op over CDP).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.goto(`${BASE}/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => window.__GT_REPLAYER_READY__ === true,
    null,
    {
      timeout: 15000,
    }
  );
  await page.waitForTimeout(1500); // reveal gate + first frames
  return page;
}

const replayText = (page) =>
  page.evaluate(
    () =>
      document.querySelector('#app #player iframe')?.contentDocument?.body
        ?.innerText || ''
  );

const server = await startServer(PORT);
const { browser, close } = await getBrowser();
try {
  // ---- scenario 1: default (source render, switching, cursor, theme) ---- //
  {
    const page = await open(browser, '');

    check('player mounts a replay iframe', (await replayText(page)).length > 0);
    check(
      'source render shows source text',
      (await replayText(page)).includes(SOURCE_TEXT)
    );

    // Capture-frame crop: the stage must take the recorded frame's 16:9 box, not
    // the recording viewport's shape.
    const ratio = await page.evaluate(() => {
      const r = document.querySelector('#app #stage').getBoundingClientRect();
      return r.width / r.height;
    });
    check(
      'stage crops to the capture frame (16:9)',
      Math.abs(ratio - 16 / 9) < 0.05,
      `ratio=${ratio.toFixed(3)}`
    );

    // Director cursor: recorded-size (scaled), positioned inside the stage.
    const cursor = await page.evaluate(() => {
      const c = document.querySelector('#app #cursor');
      const stage = document
        .querySelector('#app #stage')
        .getBoundingClientRect();
      const r = c.getBoundingClientRect();
      return {
        transform: c.style.transform,
        inStage:
          r.left >= stage.left - 1 &&
          r.top >= stage.top - 1 &&
          r.left <= stage.right &&
          r.top <= stage.bottom,
      };
    });
    check(
      'cursor is scaled to recording size',
      /translate\(.+\) scale\(/.test(cursor.transform),
      cursor.transform
    );
    check('cursor sits inside the stage', cursor.inStage);

    // Locale switcher: source + target flags, live in-place switching.
    const locs = await page.evaluate(() =>
      [...document.querySelectorAll('#app #flags button')].map(
        (b) => b.dataset.loc
      )
    );
    check(
      'flag switcher lists source-first locales',
      JSON.stringify(locs) === JSON.stringify(['en', 'es']),
      JSON.stringify(locs)
    );

    await page.click('#app #flags button[data-loc="es"]');
    await page.waitForTimeout(600);
    let text = await replayText(page);
    check(
      'es: <T> hash-path text swapped',
      ES_T.every((s) => text.includes(s))
    );
    check('es: gt()-string-path text swapped', text.includes(ES_STR));
    check('es: source text gone', !text.includes(SOURCE_TEXT));

    await page.click('#app #flags button[data-loc="en"]');
    await page.waitForTimeout(600);
    text = await replayText(page);
    check(
      'back to source: es text gone',
      text.includes(SOURCE_TEXT) && !text.includes(ES_T[0])
    );

    // Dark toggle drives the RECORDING's own theme mechanism (.dark class here).
    const bgBefore = await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('#app #player iframe').contentDocument.body
        ).backgroundColor
    );
    await page.click('#app #darkToggle');
    await page.waitForTimeout(400);
    const dark = await page.evaluate(() => {
      const idoc = document.querySelector(
        '#app #player iframe'
      ).contentDocument;
      return {
        hasClass: idoc.documentElement.classList.contains('dark'),
        bg: getComputedStyle(idoc.body).backgroundColor,
      };
    });
    check(
      'dark toggle applies the recorded theme mechanism',
      dark.hasClass && dark.bg !== bgBefore,
      `bg ${bgBefore} → ${dark.bg}`
    );

    // debug defaults OFF: a drop must be inert (no notice, no swap).
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(['garbage{{{'], 'x.json', { type: 'application/json' })
      );
      document
        .getElementById('app')
        .dispatchEvent(
          new DragEvent('drop', { dataTransfer: dt, bubbles: true })
        );
    });
    await page.waitForTimeout(300);
    check(
      'debug off: drop is inert',
      await page.evaluate(() => !document.querySelector('.gt-debug-notice'))
    );
    await page.close();
  }

  // ---- scenario 2: initialLocale renders localized from the start -------- //
  {
    const page = await open(browser, '?locale=es');
    const text = await replayText(page);
    check(
      'initialLocale=es renders localized',
      ES_T.every((s) => text.includes(s)) && !text.includes(SOURCE_TEXT)
    );
    await page.close();
  }

  // ---- scenario 3: switchLocalesAllowed:false hides the switcher --------- //
  {
    const page = await open(browser, '?locales=off');
    const hud = await page.evaluate(() => ({
      flags: document.querySelectorAll('#app #flags button').length,
      sepHidden:
        document.querySelector('#app #hudsep')?.style.display === 'none',
    }));
    check(
      'switchLocalesAllowed:false shows no flags',
      hud.flags === 0 && hud.sepHidden
    );
    check('…and still plays', (await replayText(page)).includes(SOURCE_TEXT));
    await page.close();
  }

  // ---- scenario 4: events-only bundle → embedded-overlay fallback -------- //
  {
    const page = await open(browser, '?strip=1&locale=es');
    const text = await replayText(page);
    const flags = await page.evaluate(
      () => document.querySelectorAll('#app #flags button').length
    );
    check(
      'events-only bundle recovers locales from the stream',
      flags === 2,
      `flags=${flags}`
    );
    check(
      'events-only bundle still localizes',
      ES_T.every((s) => text.includes(s))
    );
    await page.close();
  }

  // ---- scenario 5: debug drag-drop (graceful failure + hot-swap) ---------- //
  {
    const page = await open(browser, '?debug=1');
    const drop = (content, name) =>
      page.evaluate(
        ([c, n]) => {
          const dt = new DataTransfer();
          dt.items.add(new File([c], n, { type: 'application/json' }));
          document
            .getElementById('app')
            .dispatchEvent(
              new DragEvent('drop', { dataTransfer: dt, bubbles: true })
            );
        },
        [content, name]
      );

    await drop('garbage{{{', 'broken.json');
    await page.waitForTimeout(300);
    const notice = await page.evaluate(
      () => document.querySelector('.gt-debug-notice')?.textContent || ''
    );
    check(
      'debug: non-JSON drop fails gracefully',
      notice.includes('Not a JSON file'),
      notice
    );
    check(
      'debug: player survives a bad drop',
      (await replayText(page)).includes(SOURCE_TEXT)
    );

    // Drop the fixture's raw EVENTS ARRAY: hot-swap + array coercion + fallback.
    const eventsJson = await page.evaluate(() =>
      fetch('/fixture.json')
        .then((r) => r.json())
        .then((b) => JSON.stringify(b.events))
    );
    await drop(eventsJson, 'events.json');
    await page.waitForTimeout(2000);
    // Exactly one #player: destroy() cleared the old instance, no stacked players.
    const swapped = await page.evaluate(() => ({
      flags: document.querySelectorAll('#app #flags button').length,
      players: document.querySelectorAll('#app #player').length,
    }));
    check(
      'debug: events-array drop hot-swaps the replay',
      swapped.players === 1 && (await replayText(page)).includes(SOURCE_TEXT),
      JSON.stringify(swapped)
    );
    check(
      'debug: swapped replay recovers embedded locales',
      swapped.flags === 2,
      `flags=${swapped.flags}`
    );
    await page.close();
  }

  check(
    'no page errors across all scenarios',
    pageErrors.length === 0,
    pageErrors.slice(0, 3).join(' | ')
  );
} finally {
  await close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed`
);
if (failed.length) process.exitCode = 1;
