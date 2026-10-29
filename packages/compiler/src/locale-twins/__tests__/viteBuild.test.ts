/**
 * Real `vite build`s of a small app with the `'locale-twins'` translation
 * splitting strategy, on Vite 8 (Rolldown) and Vite 7 (Rollup).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type * as vite8 from 'vite';
import {
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
  LOCALE_TWIN_MANIFEST_FILE,
  parseLocaleTwinManifest,
} from 'generaltranslation/internal';
import {
  buildFixture,
  buildFixtureApp,
  createFixtureApp,
  createPlugin,
  fixtureConfig,
  VITE_VERSIONS,
  warnings,
  type FixtureApp,
} from './buildFixture';

/** Hash of the fixture's `msg('Routes label')` (absent from es.json). */
const ROUTES_LABEL_HASH = '482c32cc679e95bd';

const apps: FixtureApp[] = [];

function newApp(): FixtureApp {
  const app = createFixtureApp();
  apps.push(app);
  return app;
}

afterEach(() => {
  for (const app of apps.splice(0)) app.cleanup();
});

/** Twin file names: `<name>.<locale>-<version>.js`. */
function isTwin(fileName: string): boolean {
  return /\.[a-z]{2}-[0-9a-f]{8}\.js$/.test(fileName);
}

function chunkContaining(app: FixtureApp, text: string): string {
  const matches = app
    .jsFiles()
    .filter((name) => !isTwin(name))
    .filter((name) => app.read(name).includes(text));
  expect(matches, `exactly one original chunk contains ${text}`).toHaveLength(
    1
  );
  return matches[0];
}

describe.each(VITE_VERSIONS)('$name client build', ({ load }) => {
  it('writes a twin per locale for every twinned chunk and the manifest at the outDir root', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.locales).toEqual(['en', 'fr', 'es']);

    const entry = chunkContaining(app, 'Welcome home');
    const about = chunkContaining(app, 'About us');
    expect(manifest.entries).toEqual([entry]);
    expect(manifest.twinned).toEqual(expect.arrayContaining([entry, about]));

    for (const locale of manifest.locales) {
      for (const fileName of manifest.twinned) {
        const twin = manifest.twins[locale][fileName];
        expect(path.posix.dirname(twin)).toBe(path.posix.dirname(fileName));
        expect(findLocaleTwinPlaceholders(app.read(twin))).toEqual([]);
      }
    }
    // Twins carry their locale's table and import that locale's twins
    const frEntry = app.read(manifest.twins.fr[entry]);
    expect(frEntry).toContain('Bienvenue à la maison');
    expect(frEntry).toContain(path.posix.basename(manifest.twins.fr[about]));
    expect(app.read(manifest.twins.fr[about])).toContain('À propos de nous');
    expect(app.read(manifest.twins.es[about])).toContain('Sobre nosotros');
    expect(app.read(manifest.twins.en[about])).toContain('About us');
  });

  it('keeps library code in a shared vendor chunk, except library modules that import the app', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    const vendor = chunkContaining(app, 'fake-lib library code');
    expect(path.posix.basename(vendor)).toMatch(/^vendor-/);
    expect(manifest.twinned).not.toContain(vendor);
    // fake-framework imports the app's routes: it stays with the app
    const vendorCode = app.read(vendor);
    expect(vendorCode).not.toContain('fake-framework imports app code');
    expect(vendorCode).not.toContain('Routes label');
    // The plain page imports only the vendor chunk, so it is shared too
    expect(manifest.twinned).not.toContain(
      chunkContaining(app, 'plain page without translations')
    );
    expect(warnings(app).join('\n')).not.toContain('multiply the JS output');
  });

  it('writes a source map for every twin when the build emits source maps', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, {}, { build: { sourcemap: true } });

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    for (const twin of Object.values(manifest.twins.fr)) {
      const map = JSON.parse(app.read(`${twin}.map`));
      expect(map.file).toBe(path.posix.basename(twin));
      expect(app.read(twin)).toContain(
        `//# sourceMappingURL=${path.posix.basename(twin)}.map`
      );
    }
  });

  it('replaces the previous twins when rebuilding into the same outDir', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);
    const first = parseLocaleTwinManifest(app.read(LOCALE_TWIN_MANIFEST_FILE));

    const frPath = path.join(app.dir, 'src', '_gt', 'fr.json');
    const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
    fs.writeFileSync(
      frPath,
      JSON.stringify({ ...fr, '9564e3123aec3de1': 'Qui sommes-nous' })
    );
    await buildFixture(vite, app, {}, { build: { emptyOutDir: false } });
    const second = parseLocaleTwinManifest(app.read(LOCALE_TWIN_MANIFEST_FILE));

    expect(second.versions.fr).not.toBe(first.versions.fr);
    expect(second.versions.es).toBe(first.versions.es);
    for (const twin of Object.values(first.twins.fr)) {
      expect(app.exists(twin)).toBe(false);
    }
    for (const twin of Object.values(second.twins.fr)) {
      expect(app.exists(twin)).toBe(true);
    }
    for (const twin of Object.values(second.twins.es)) {
      expect(app.exists(twin)).toBe(true);
    }
  });

  it("does nothing with the default 'locale' splitting strategy", async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, { splitting: 'locale' });

    expect(app.exists(LOCALE_TWIN_MANIFEST_FILE)).toBe(false);
    expect(app.exists('gt-locale-twins-report.json')).toBe(false);
    expect(app.jsFiles().some((name) => name.includes('vendor-'))).toBe(false);
    expect(app.jsFiles().filter(isTwin)).toEqual([]);
  });

  it('writes the build report and warns about missing translations', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    const report = JSON.parse(app.read('gt-locale-twins-report.json'));
    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    expect(report).toMatchObject({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      twinned: manifest.twinned,
      // es.json has no "Routes label"
      missingTranslations: { es: [ROUTES_LABEL_HASH] },
    });
    expect(report.shared).toContain(
      chunkContaining(app, 'fake-lib library code')
    );
    expect(Object.keys(report.twinBytes)).toEqual(['en', 'fr', 'es']);
    expect(report.outputMultiplier).toBeGreaterThan(1);
    expect(warnings(app)).toEqual([
      expect.stringContaining(
        'Warning: 1 translation is missing from the locale twins for es'
      ),
    ]);
    expect(app.logs.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /Locale twins: 2 twinned and 2 shared JS files, 3 locales/
        ),
      ])
    );
  });

  it("fails the build on missing translations with missingTranslations: 'error'", async () => {
    const vite = await load();
    const app = newApp();
    await expect(
      buildFixture(vite, app, {
        localeTwins: { missingTranslations: 'error' },
      })
    ).rejects.toThrow(
      /Error: 1 translation is missing from the locale twins for es/
    );
  });

  it('warns when translation files are missing and twins the source text', async () => {
    const vite = await load();
    const app = newApp();
    fs.rmSync(path.join(app.dir, 'src', '_gt', 'es.json'));
    await buildFixture(vite, app);

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    const about = chunkContaining(app, 'About us');
    expect(app.read(manifest.twins.es[about])).toContain(
      '{\\"l\\":\\"es\\",\\"e\\":{\\"9564e3123aec3de1\\":\\"About us\\"}}'
    );
    expect(warnings(app)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Warning: Locale twins could not find some translation files'
        ),
      ])
    );
    expect(warnings(app).join('\n')).toContain(
      path.join(app.dir, 'src', '_gt', 'es.json')
    );
  });

  it('fails the build when a file served as built contains a placeholder', async () => {
    const vite = await load();
    const app = newApp();
    const leak: vite8.Plugin = {
      name: 'leak-placeholder',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'leak.json',
          source: JSON.stringify(
            encodeLocaleTwinPlaceholder({ [ROUTES_LABEL_HASH]: 'Routes label' })
          ),
        });
      },
    };
    await expect(
      buildFixture(vite, app, {}, { plugins: [leak] })
    ).rejects.toThrow(/unfilled locale twin placeholders[\s\S]*leak\.json/);
  });

  it('warns that nothing is attributed when compileTimeHash is off', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, { compileTimeHash: false });

    expect(warnings(app)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Warning: Locale twins are on, but compileTimeHash is off'
        ),
      ])
    );
  });

  it("keeps the user's own chunking and warns that no vendor chunk was added", async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(
      vite,
      app,
      {},
      {
        build: {
          rollupOptions: {
            output: {
              manualChunks: (id: string) =>
                id.includes('fake-lib') ? 'mylib' : undefined,
            },
          },
        },
      }
    );

    const names = app.jsFiles().map((name) => path.posix.basename(name));
    expect(names.some((name) => name.startsWith('mylib-'))).toBe(true);
    expect(names.some((name) => name.startsWith('vendor-'))).toBe(false);
    expect(warnings(app)).toEqual(
      expect.arrayContaining([
        // Vite 8 reports the rolldownOptions alias of rollupOptions
        expect.stringMatching(
          /Locale twins did not add the default vendor chunk because build\.roll(up|down)Options\.output\.manualChunks is already configured/
        ),
      ])
    );
  });

  it('adds no vendor chunk and no warning when vendorChunk is off', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, { localeTwins: { vendorChunk: false } });

    expect(app.jsFiles().some((name) => name.includes('vendor-'))).toBe(false);
    expect(warnings(app).join('\n')).not.toContain('vendor chunk because');
  });

  it('warns about a large output multiplier when library code is twinned', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, { localeTwins: { vendorChunk: false } });

    expect(app.jsFiles().some((name) => name.includes('vendor-'))).toBe(false);
    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    // Without a vendor chunk the library lands in the (twinned) entry chunk
    expect(manifest.twinned).toContain(
      chunkContaining(app, 'fake-framework imports app code')
    );
    expect(warnings(app)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /Warning: Locale twins multiply the JS output by \d+\.\d\d/
        ),
      ])
    );
  });
});

/** Imports the built server entry (`src/server.js`). */
async function importServer(
  app: FixtureApp
): Promise<{ render(): { manifest: unknown } }> {
  return import(
    pathToFileURL(path.join(app.outDir, 'server', 'server.mjs')).href
  );
}

describe.each(VITE_VERSIONS)('$name client and server builds', ({ load }) => {
  it('leaves the server environment untouched and gives it the client manifest', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixtureApp(vite, app);

    const manifest = parseLocaleTwinManifest(
      app.read(`client/${LOCALE_TWIN_MANIFEST_FILE}`)
    );
    const serverFiles = app
      .jsFiles()
      .filter((name) => name.startsWith('server/'));
    expect(serverFiles.length).toBeGreaterThan(0);
    expect(app.exists(`server/${LOCALE_TWIN_MANIFEST_FILE}`)).toBe(false);
    expect(app.exists('server/gt-locale-twins-report.json')).toBe(false);
    expect(serverFiles.filter(isTwin)).toEqual([]);
    expect(serverFiles.some((name) => name.includes('vendor-'))).toBe(false);

    // The server keeps its unfilled (inert) placeholder
    const serverCode = serverFiles.map((name) => app.read(name)).join('\n');
    expect(findLocaleTwinPlaceholders(serverCode)).not.toEqual([]);
    // and bundles the client manifest
    const server = await importServer(app);
    expect(server.render().manifest).toEqual(manifest);
  });

  it('fails a server build that runs before the client build', async () => {
    const vite = await load();
    const app = newApp();
    await expect(
      buildFixtureApp(vite, app, {}, { only: 'ssr' })
    ).rejects.toThrow(/The locale twin manifest was not found/);
  });

  it('gives the server a null manifest when locale twins are off', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixtureApp(vite, app, { splitting: 'locale' }, { only: 'ssr' });

    const server = await importServer(app);
    expect(server.render().manifest).toBeNull();
  });
});

describe.each(VITE_VERSIONS)('$name dev server', ({ load }) => {
  it('prints the dev notice and serves a null manifest', async () => {
    const vite = await load();
    const app = newApp();
    const server = await vite.createServer({
      ...fixtureConfig(app, createPlugin(app)),
      server: { middlewareMode: true, ws: false },
    });
    try {
      const module = await server.ssrLoadModule(
        'virtual:gt-locale-twins-manifest'
      );
      expect(module.manifest).toBeNull();
      expect(app.logs).toEqual(
        expect.arrayContaining([
          {
            type: 'info',
            message: expect.stringContaining(
              'Locale twins are only generated by `vite build`'
            ),
          },
        ])
      );
    } finally {
      await server.close();
    }
  });
});
