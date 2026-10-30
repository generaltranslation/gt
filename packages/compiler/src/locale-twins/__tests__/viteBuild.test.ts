/**
 * Real `vite build`s of a small app with the `'locale-twins'` translation
 * splitting strategy, on Vite 8 (Rolldown) and Vite 7 (Rollup).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as vite8 from 'vite';
import {
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
  LOCALE_TWIN_MANIFEST_FILE,
  parseLocaleTwinManifest,
} from 'generaltranslation/internal';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import {
  createLocaleTwinDocument,
  LOCALE_TWIN_BOOTSTRAP_SCRIPT,
  parseLocaleTwinDocument,
} from 'gt-i18n/internal/locale-twins';
import {
  buildFixture,
  buildFixtureApp,
  createFixtureApp,
  createPlugin,
  fixtureConfig,
  REPORT_PATH,
  VITE_VERSIONS,
  warnings,
  type FixtureApp,
} from './buildFixture';

/** Hashes of the fixture's msg() entries (es.json has no "Routes label"). */
const WELCOME_HOME_HASH = 'eb5953dcba9ac3b5';
const ABOUT_US_HASH = '9564e3123aec3de1';
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

/** The original chunk whose placeholder carries `hash` (source text is stripped). */
function chunkWithEntry(app: FixtureApp, hash: string): string {
  const matches = app
    .jsFiles()
    .filter((name) => !isTwin(name))
    .filter((name) =>
      findLocaleTwinPlaceholders(app.read(name)).some((match) =>
        match.hashes.includes(hash)
      )
    );
  expect(matches, `exactly one chunk registers ${hash}`).toHaveLength(1);
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

    const entry = chunkWithEntry(app, WELCOME_HOME_HASH);
    const about = chunkWithEntry(app, ABOUT_US_HASH);
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
    // Client code carries source text only in the source-locale twin
    expect(app.read(about)).not.toContain('About us');
    expect(app.read(manifest.twins.fr[about])).not.toContain('About us');
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
    expect(fs.existsSync(path.join(app.dir, REPORT_PATH))).toBe(false);
    expect(app.jsFiles().some((name) => name.includes('vendor-'))).toBe(false);
    expect(app.jsFiles().filter(isTwin)).toEqual([]);
  });

  it('writes the build report outside the public outDir and warns about missing translations', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    expect(app.exists('gt-locale-twins-report.json')).toBe(false);
    const report = app.report();
    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    expect(report).toMatchObject({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      twinned: manifest.twinned,
      // es.json has no "Routes label"
      missingTranslations: { es: [ROUTES_LABEL_HASH] },
      // msg() with a custom hash keeps its source text in code
      unattributed: [
        {
          file: 'src/footer.js',
          line: 5,
          column: 20,
          api: 'msg()',
          reason: 'customHash',
        },
      ],
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
          /Locale twins: 2 twinned and 2 shared JS files, 3 locales.*Report: node_modules\/\.cache\/gt\/gt-locale-twins-report\.json/
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
    const about = chunkWithEntry(app, ABOUT_US_HASH);
    expect(app.read(manifest.twins.es[about])).toContain(
      `{\\"l\\":\\"es\\",\\"e\\":{\\"${ABOUT_US_HASH}\\":\\"About us\\"},\\"s\\":[\\"${ABOUT_US_HASH}\\"]}`
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

  it('reports unattributed entries once per client build', async () => {
    const vite = await load();
    const app = newApp();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await buildFixture(vite, app);
      const unattributed = consoleWarn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('footer.js'));
      expect(unattributed).toHaveLength(1);
      expect(unattributed[0]).toContain(
        'msg(): has a custom hash that is not a compile-time hash'
      );
    } finally {
      consoleWarn.mockRestore();
    }
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

  // Rollup rejects manualChunks with preserveModules
  it('adds no vendor chunk to a preserveModules build and warns', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(
      vite,
      app,
      {},
      {
        build: {
          rollupOptions: {
            preserveEntrySignatures: 'exports-only',
            output: { preserveModules: true },
          },
        },
      }
    );

    expect(app.jsFiles().some((name) => name.includes('vendor-'))).toBe(false);
    expect(app.exists(LOCALE_TWIN_MANIFEST_FILE)).toBe(true);
    expect(warnings(app)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /Locale twins did not add the default vendor chunk because build\.roll(up|down)Options\.output\.preserveModules is already configured/
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

/** Every module script `src` and modulepreload `href` in a document. */
function moduleUrls(html: string): string[] {
  return [
    ...html.matchAll(
      /<script\b[^>]*type="module"[^>]*\bsrc="([^"]+)"|<link\b[^>]*rel="modulepreload"[^>]*\bhref="([^"]+)"/g
    ),
  ].map((match) => match[1] ?? match[2]);
}

function inlineBootstrap(html: string): string | undefined {
  return /<script data-gt-locale-twins-bootstrap>([\s\S]*?)<\/script>/.exec(
    html
  )?.[1];
}

describe.each(VITE_VERSIONS)('$name SPA document', ({ load }) => {
  it('selects the entry twin in the browser with an inline bootstrap', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    const html = app.read('index.html');
    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    const [entry] = manifest.entries;
    const twinned = new Set(manifest.twinned.map((name) => `/${name}`));

    // Only shared files are still referenced statically
    expect(moduleUrls(html).length).toBeGreaterThan(0);
    for (const url of moduleUrls(html)) expect(twinned.has(url)).toBe(false);
    expect(html).not.toContain(path.posix.basename(entry));
    // The data block names each locale's entry twin
    const { data } = parseLocaleTwinDocument(html);
    expect(data).toMatchObject({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      localeCookieName: defaultLocaleCookieName,
    });
    const script = data.tags.find((tag) => tag.tag === 'script');
    expect(script?.attributes).toEqual({ type: 'module', crossorigin: '' });
    for (const locale of manifest.locales) {
      expect(script?.urls[locale]).toBe(`/${manifest.twins[locale][entry]}`);
      for (const tag of data.tags) {
        expect(app.exists(tag.urls[locale].slice(1))).toBe(true);
      }
    }

    // The inline bootstrap and its CSP hash
    const bootstrap = inlineBootstrap(html);
    expect(bootstrap).toBe(LOCALE_TWIN_BOOTSTRAP_SCRIPT);
    const report = app.report();
    expect(report.spa).toEqual({
      bootstrap: 'inline',
      documents: ['index.html'],
      cspHash: `sha256-${createHash('sha256').update(bootstrap!).digest('base64')}`,
    });
  });

  it('modulepreloads the twins of twinned static imports per locale', async () => {
    const vite = await load();
    const app = newApp();
    // Without the vendor chunk the library and the app share twinned chunks
    await buildFixture(
      vite,
      app,
      { localeTwins: { vendorChunk: false } },
      {
        build: {
          rollupOptions: {
            output: {
              manualChunks: (id: string) =>
                id.includes('footer') ? 'footer' : undefined,
            },
          },
        },
      }
    );

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    const footer = manifest.twinned.find((name) =>
      path.posix.basename(name).startsWith('footer-')
    );
    expect(footer).toBeDefined();
    const { data } = parseLocaleTwinDocument(app.read('index.html'));
    const preload = data.tags.find((tag) => tag.tag === 'link');
    expect(preload?.attributes).toEqual({
      rel: 'modulepreload',
      crossorigin: '',
    });
    expect(preload?.urls.fr).toBe(`/${manifest.twins.fr[footer!]}`);
    expect(moduleUrls(app.read('index.html'))).not.toContain(`/${footer}`);
  });

  it('can be served per request locale by the server helper', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app);

    const manifest = parseLocaleTwinManifest(
      app.read(LOCALE_TWIN_MANIFEST_FILE)
    );
    const [entry] = manifest.entries;
    const document = createLocaleTwinDocument({ html: app.read('index.html') });
    const html = await document
      .respond(
        new Request('https://example.com/', {
          headers: { cookie: `${defaultLocaleCookieName}=es` },
        })
      )
      .text();

    expect(html).toContain('<html lang="es">');
    expect(html).toContain(
      `<script type="module" crossorigin src="/${manifest.twins.es[entry]}"></script>`
    );
    expect(html).not.toContain('gt-locale-twins');
  });

  it('loads an external bootstrap with spaBootstrap: external', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, {
      localeTwins: { spaBootstrap: 'external', localeCookieName: 'app-locale' },
    });

    const html = app.read('index.html');
    expect(inlineBootstrap(html)).toBeUndefined();
    const src =
      /<script data-gt-locale-twins-bootstrap src="([^"]+)"><\/script>/.exec(
        html
      )?.[1];
    expect(src).toMatch(
      /^\/assets\/gt-locale-twins-bootstrap\.[0-9a-f]{8}\.js$/
    );
    expect(app.read(src!.slice(1))).toBe(LOCALE_TWIN_BOOTSTRAP_SCRIPT);
    expect(parseLocaleTwinDocument(html).data.localeCookieName).toBe(
      'app-locale'
    );
    const report = app.report();
    expect(report.spa).toEqual({
      bootstrap: 'external',
      documents: ['index.html'],
      bootstrapFile: src!.slice(1),
    });
  });

  it.each(['/app/', './'])(
    'keeps the base path (%s) in twin URLs',
    async (base) => {
      const vite = await load();
      const app = newApp();
      await buildFixture(vite, app, {}, { base });

      const manifest = parseLocaleTwinManifest(
        app.read(LOCALE_TWIN_MANIFEST_FILE)
      );
      const [entry] = manifest.entries;
      const { data } = parseLocaleTwinDocument(app.read('index.html'));
      expect(data.tags[0].urls.fr).toBe(`${base}${manifest.twins.fr[entry]}`);
    }
  );

  it("leaves the document alone with the 'locale' strategy", async () => {
    const vite = await load();
    const app = newApp();
    await buildFixture(vite, app, { splitting: 'locale' });

    expect(app.read('index.html')).not.toContain('gt-locale-twins');
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

  it('keeps library code shared when the client entry is a library module that imports the app', async () => {
    const vite = await load();
    const app = newApp();
    await buildFixtureApp(vite, app, {}, { clientEntry: 'fake-start' });

    const manifest = parseLocaleTwinManifest(
      app.read(`client/${LOCALE_TWIN_MANIFEST_FILE}`)
    );
    const libraryChunks = app
      .jsFiles()
      .filter((name) => name.startsWith('client/') && !isTwin(name))
      .filter((name) => app.read(name).includes('fake-lib library code'));
    expect(libraryChunks).toHaveLength(1);
    const vendor = libraryChunks[0];
    expect(path.posix.basename(vendor)).toMatch(/^vendor-/);
    expect(manifest.twinned).not.toContain(vendor.replace(/^client\//, ''));
    // The entry and the library modules that import the app stay with it
    const vendorCode = app.read(vendor);
    expect(vendorCode).not.toContain('fake-start client entry');
    expect(vendorCode).not.toContain('fake-framework imports app code');
    expect(warnings(app).join('\n')).not.toContain('multiply the JS output');
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

describe('Vite 8 chunk import map', () => {
  // The import map would point every locale at the original chunks
  it('fails a locale twins build with build.chunkImportMap', async () => {
    const vite = await VITE_VERSIONS[0].load();
    const app = newApp();
    await expect(
      buildFixture(vite, app, {}, {
        build: { chunkImportMap: true },
      } as vite8.InlineConfig)
    ).rejects.toThrow(/Locale twins do not support build\.chunkImportMap/);
  });
});
