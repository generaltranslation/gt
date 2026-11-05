/**
 * Locale twins are experimental and live behind the `/experimental` entry
 * points, so an app that imports GT from the regular entry points must not
 * pay for them. This builds the app (no twins) and checks that the client JS
 * carries no locale twin code and that GT's client chunk stays the size it
 * has without locale twins.
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
 * Sizes measured on the samsara merge base (098ff41ee, before the locale
 * twins work): gt-react's client chunk (`assets/index.client-*.js`) and all
 * JS, in bytes, gzip with Node's default level. Update them only for
 * deliberate growth.
 */
const BASELINE = {
  gtChunk: { min: 113_030, gzip: 36_457 },
  allJs: { min: 317_569, gzip: 101_189 },
};

/**
 * Growth allowed over the baseline, in gzip bytes. The regular entry points
 * carry no locale twin code, so this only absorbs incidental noise.
 */
const GZIP_BUDGET = { gtChunk: 8, allJs: 16 };

/**
 * Strings that only locale twin code contains: the registration export and
 * placeholder prefix, the navigating-reload brand (locale switch rule), the
 * SPA document data block, the config key, and the runtime's diagnostics.
 */
const TWIN_RUNTIME_MARKERS = [
  'GtInternalRegisterLocaleTwin',
  '__GT_LOCALE_TWIN__',
  'generaltranslation.locale-twins.navigating-reload',
  'gt-locale-twins-data',
  'experimental.splitting',
  'locale-twins',
  'A locale twin could not be registered',
  'but GT is rendering',
  'the runtime is not in locale twin mode',
];

type JsFile = { name: string; code: string; gzip: number };

describe('vite-react client bundle with the regular GT entry points', () => {
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

  it('ships no locale twin code', () => {
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
