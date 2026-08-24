// Regenerate e2e/fixture.json: record e2e/fixture-page.html with the real
// @rrweb/record (the recorder core's options), click through it, then harvest the
// per-locale overlay with the BUILT harvest (dist/harvest.mjs) against an inline
// translations dict — no network. The result is shaped exactly like a
// RecorderBundle: structured {events, locales, overlay} PLUS the gt-locales /
// gt-i18n custom events embedded in the stream (what the recorder itself emits),
// so run.mjs can exercise both the structured and the events-only fallback paths.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { harvestLocales } from '../dist/harvest.mjs';
import { getBrowser, newPage } from './browser.mjs';
import { startServer } from './serve.mjs';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = 5641;
const LOCALES = ['en', 'es']; // source first

// The fixture page's translations. `fx-*` entries are <T> content (matched by the
// data-_gt-hash attributes in fixture-page.html); the `str:` entry is a bare
// gt()-style string (matched by hashing the recorded source text, below).
const DICT_ES = {
  'fx-welcome': 'Bienvenido al fixture',
  'fx-run': 'Ejecutar la demo',
  'str:Settings and Projects live here': 'Los ajustes y proyectos viven aquí',
};
const hashMessage = (message) => `str:${message}`;

const server = await startServer(PORT);
const { browser, close } = await getBrowser();
try {
  const page = await newPage(browser);
  // Over CDP, page.setViewportSize is a NO-OP — the recording would be framed
  // against the real (often tiny) window and replay "zoomed in". Drive the actual
  // device metrics instead; this also pins the fixture across environments.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.goto(`http://localhost:${PORT}/fixture-page.html`, {
    waitUntil: 'load',
  });

  // Start recording in-page with the recorder core's options (recorderCore.ts).
  await page.evaluate(async () => {
    const { record } = await import('/rrweb-record/record.js');
    window.__events = [];
    window.__stop = record({
      emit(event) {
        window.__events.push(event);
      },
      sampling: { mousemove: false },
      maskAllInputs: true,
      inlineStylesheet: false,
      collectFonts: true,
    });
    // The recorder stamps its traced locales into the stream (self-describing).
    record.addCustomEvent('gt-locales', {
      locales: ['en', 'es'],
      sourceLocale: 'en',
    });
  });

  // Real clicks with real coordinates → click waypoints + the mutations they cause.
  const go = await page.locator('#go').boundingBox();
  await page.mouse.click(go.x + go.width / 2, go.y + go.height / 2);
  await page.waitForTimeout(700);
  await page.mouse.click(go.x + 10, go.y + go.height / 2);
  await page.waitForTimeout(700);

  const events = await page.evaluate(() => {
    window.__stop();
    return window.__events;
  });

  // Harvest with the BUILT dist — the same code the recorder ships.
  const overlay = await harvestLocales(events, LOCALES, {
    loadTranslations: async (locale) => (locale === 'es' ? DICT_ES : null),
    hashMessage,
    sourceLocale: 'en',
  });

  // Embed the overlay in the stream right after the FullSnapshot, exactly like the
  // recorder's injectOverlay — the events-only fallback path reads it from here.
  const at = Math.max(
    0,
    events.findIndex((e) => e.type === 2)
  );
  events.splice(at + 1, 0, {
    type: 5,
    data: { tag: 'gt-i18n', payload: overlay },
    timestamp: events[at]?.timestamp ?? 0,
  });

  const es = overlay.es || {};
  const esCount = Object.keys(es).length;
  const clicks = events.filter(
    (e) => e.type === 3 && e.data.source === 2 && e.data.type === 2
  ).length;
  const meta = events.find((e) => e.type === 4);
  console.log(
    `fixture: ${events.length} events | viewport ${meta.data.width}x${meta.data.height} | clicks ${clicks} | es overlay ${esCount}`
  );
  // The dict has 3 entries; all must land or the fixture is broken.
  if (esCount < 3 || clicks < 2) {
    console.error(
      'FIXTURE INVALID: expected ≥3 es overlay entries and ≥2 clicks'
    );
    process.exitCode = 1;
  } else {
    // Pretty-printed and then run through the repo's oxfmt (its JSON style — e.g.
    // short arrays inline — differs from JSON.stringify), so the committed fixture
    // is diffable and `pnpm lint` stays clean right after regenerating.
    const out = join(E2E_DIR, 'fixture.json');
    writeFileSync(
      out,
      JSON.stringify({ events, locales: LOCALES, overlay }, null, 2) + '\n'
    );
    try {
      execSync(`npx oxfmt ${JSON.stringify(out)}`, { stdio: 'ignore' });
    } catch {
      console.warn('oxfmt not available — run `npx oxfmt e2e/fixture.json`');
    }
    console.log('wrote e2e/fixture.json');
  }
} finally {
  await close();
  server.close();
}
