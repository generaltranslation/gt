/**
 * Locale twins (`files.gt.splitting: 'locale-twins'`) are opt-in, so an app
 * that does not use them must not pay for their runtime. This builds the app
 * (no twins) and checks that the client JS carries no locale twin runtime and
 * that GT's client chunk stays within a small budget of the size it had
 * before locale twins existed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Sizes measured on the commit before locale twins (b462015ce): gt-react's
 * client chunk (`assets/index.client-*.js`) and all JS, in bytes, gzip with
 * Node's default level. Update them only for deliberate growth.
 */
const BASELINE = {
  gtChunk: { min: 113_076, gzip: 36_454 },
  allJs: { min: 317_682, gzip: 101_187 },
};

/**
 * Growth allowed over the baseline, in gzip bytes. Every app keeps the core
 * locale twin checks (about 500 B gzip in the GT chunk, 100 B in react-core
 * code): the hook checks at each lookup, the twin client decision that turns
 * off the translation loader, and the missing compiler plugin diagnostic.
 */
const GZIP_BUDGET = { gtChunk: 550, allJs: 650 };

/**
 * Strings that only the locale twin runtime contains: the placeholder prefix
 * (registration), the navigating-reload brand (locale switch rule), and the
 * runtime's mismatch diagnostics.
 */
const TWIN_RUNTIME_MARKERS = [
  '__GT_LOCALE_TWIN__',
  'generaltranslation.locale-twins.navigating-reload',
  'A locale twin could not be registered',
  'but GT is rendering',
  'the runtime is not in locale twin mode',
  'Dictionary entries render untranslated',
];

type JsFile = { name: string; code: string; gzip: number };

describe('vite-react client bundle without locale twins', () => {
  let outDir: string;
  let files: JsFile[];

  beforeAll(async () => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vite-react-size-'));
    // Vitest sets NODE_ENV=test, which would build React's development code
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root: appDir,
        configFile: path.join(appDir, 'vite.config.ts'),
        mode: 'production',
        build: { outDir, emptyOutDir: true },
        logLevel: 'warn',
      });
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
    const assetsDir = path.join(outDir, 'assets');
    files = fs
      .readdirSync(assetsDir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => {
        const code = fs.readFileSync(path.join(assetsDir, name), 'utf8');
        return { name, code, gzip: gzipSync(code).length };
      });
  }, 120_000);

  afterAll(() => {
    if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('ships no locale twin runtime', () => {
    const found = files.flatMap(({ name, code }) =>
      TWIN_RUNTIME_MARKERS.filter((marker) => code.includes(marker)).map(
        (marker) => `${name}: ${marker}`
      )
    );
    expect(found).toEqual([]);
  });

  it("keeps GT's client chunk within budget", () => {
    const gtChunk = files.find(({ name }) => name.startsWith('index.client-'));
    expect(gtChunk, 'the gt-react client chunk').toBeDefined();
    expect(gtChunk!.gzip).toBeLessThanOrEqual(
      BASELINE.gtChunk.gzip + GZIP_BUDGET.gtChunk
    );
  });

  it('keeps all client JS within budget', () => {
    const gzip = files.reduce((sum, file) => sum + file.gzip, 0);
    expect(gzip).toBeLessThanOrEqual(BASELINE.allJs.gzip + GZIP_BUDGET.allJs);
  });
});
