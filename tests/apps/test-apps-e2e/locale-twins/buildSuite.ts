/**
 * Node-level acceptance checks for a locale twin SPA build (spec §9.2 at file
 * level, §9.7, §9.8), shared by the twin test apps. Each app's Vitest file
 * passes its test functions and a `build` callback; assertions use
 * `node:assert` so this module needs no test runner of its own.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  attributedHashes,
  checkAttribution,
  checkIsolation,
  derivedEntryHashes,
  distinctiveSegments,
  expectedInlineValues,
  readTranslations,
  readTwinDocumentData,
  readTwinManifest,
  readTwinReport,
  referencedJsFiles,
  servedFiles,
  textSegments,
  TWIN_REPORT_FILE,
  UNFILLED_PLACEHOLDER_PATTERN,
  type TranslationFile,
  type TwinManifest,
  type TwinReport,
} from './twinOutput';

type Hook = (fn: () => void | Promise<void>, timeout?: number) => void;

export type BuildSuiteTestApi = {
  describe(name: string, fn: () => void): void;
  it(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  beforeAll: Hook;
  afterAll: Hook;
};

export type LocaleTwinsBuildSuiteOptions = {
  /** The app's Vite root (the build report is written below it). */
  root: string;
  /** Directory with the committed `[locale].json` files. */
  translationsDir: string;
  /** Builds the app's client into `outDir`, reading `translationsDir`. */
  build(options: { outDir: string; translationsDir: string }): Promise<void>;
  /** Built documents, relative to the client outDir (default `index.html`). */
  documents?: string[];
};

const BUILD_TIMEOUT = 120_000;
const TEXT_FILE = /\.(?:m?js|css|html)$/;

type Build = {
  outDir: string;
  manifest: TwinManifest;
  report: TwinReport;
};

export function defineLocaleTwinsBuildSuite(
  { describe, it, beforeAll, afterAll }: BuildSuiteTestApi,
  options: LocaleTwinsBuildSuiteOptions
): void {
  const documents = options.documents ?? ['index.html'];
  const tmpRoot = fs.realpathSync(os.tmpdir());
  const tmpDirs: string[] = [];
  let first: Build;
  let translations: Record<string, TranslationFile>;
  let attributed: Set<string>;

  const makeTmpDir = (prefix: string) => {
    const dir = fs.mkdtempSync(path.join(tmpRoot, prefix));
    tmpDirs.push(dir);
    return dir;
  };

  const runBuild = async (translationsDir: string): Promise<Build> => {
    const outDir = makeTmpDir('gt-twins-build-');
    // Vitest sets NODE_ENV=test, which Vite keeps: build what `vite build`
    // builds (production React and GT runtime).
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await options.build({ outDir, translationsDir });
    } finally {
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
    }
    return {
      outDir,
      manifest: readTwinManifest(outDir),
      report: readTwinReport(options.root),
    };
  };

  const read = (build: Build, file: string) =>
    fs.readFileSync(path.join(build.outDir, file), 'utf8');

  describe('locale twins build output', () => {
    beforeAll(async () => {
      first = await runBuild(options.translationsDir);
      translations = readTranslations(
        options.translationsDir,
        first.manifest.locales
      );
      attributed = attributedHashes(first.report);
    }, BUILD_TIMEOUT);

    afterAll(() => {
      for (const dir of tmpDirs)
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('writes a version 1 manifest with a twin of every entry per locale', () => {
      const { manifest } = first;
      assert.equal(manifest.version, 1);
      assert.ok(manifest.locales.includes(manifest.defaultLocale));
      assert.ok(manifest.locales.length >= 4, 'at least four locales');
      assert.ok(manifest.entries.length > 0, 'the entry chunk is twinned');
      for (const locale of manifest.locales) {
        assert.match(manifest.versions[locale], /^[0-9a-f]{8}$/);
        assert.deepEqual(
          Object.keys(manifest.twins[locale]).sort(),
          [...manifest.twinned].sort()
        );
      }
    });

    it('attributes every translation file entry except the reported unattributed ones', () => {
      const source = translations[first.manifest.defaultLocale];
      assert.deepEqual(
        checkAttribution({ source, attributed, report: first.report }),
        []
      );
      assert.ok(
        first.report.unattributed.length > 0,
        'the app has an unattributed control'
      );
    });

    it('translates every attributed entry (no missing translations)', () => {
      assert.deepEqual(first.report.missingTranslations, {});
    });

    it('keeps the build report out of the client output', () => {
      assert.ok(!fs.existsSync(path.join(first.outDir, TWIN_REPORT_FILE)));
    });

    it('leaves no unfilled placeholder in any served file (§9.8)', () => {
      for (const locale of first.manifest.locales) {
        for (const file of servedFiles(first.outDir, first.manifest, locale)) {
          if (!TEXT_FILE.test(file)) continue;
          assert.doesNotMatch(
            read(first, file),
            UNFILLED_PLACEHOLDER_PATTERN,
            `${file} has an unfilled placeholder`
          );
        }
      }
    });

    it('fills every placeholder of a twin with its locale’s content (or a source fallback)', () => {
      const { manifest } = first;
      for (const locale of manifest.locales) {
        for (const [original, twin] of Object.entries(manifest.twins[locale])) {
          const code = read(first, twin);
          for (const expected of expectedInlineValues(
            read(first, original),
            locale,
            manifest.defaultLocale,
            translations
          )) {
            assert.ok(code.includes(expected), `${twin} lacks ${expected}`);
          }
        }
      }
    });

    it('closes each locale twin set over same-locale twins and shared files', () => {
      const { manifest, report } = first;
      const jsFiles = [
        ...manifest.twinned,
        ...report.shared,
        ...Object.values(manifest.twins).flatMap((twins) =>
          Object.values(twins)
        ),
      ];
      const shared = new Set(report.shared);
      for (const locale of manifest.locales) {
        const own = new Set(Object.values(manifest.twins[locale]));
        for (const twin of own) {
          const outside = referencedJsFiles(read(first, twin), jsFiles).filter(
            (file) => !own.has(file) && !shared.has(file)
          );
          assert.deepEqual(outside, [], `${twin} imports outside its set`);
        }
      }
      for (const file of shared) {
        const twinnedRefs = referencedJsFiles(
          read(first, file),
          jsFiles
        ).filter((ref) => !shared.has(ref));
        assert.deepEqual(
          twinnedRefs,
          [],
          `shared ${file} names a twinned file`
        );
      }
    });

    it('serves each locale only its own strings, source locale included (§9.2)', () => {
      const segments = distinctiveSegments(translations, attributed);
      for (const locale of first.manifest.locales) {
        const text = servedFiles(first.outDir, first.manifest, locale)
          .filter((file) => TEXT_FILE.test(file))
          .map((file) => read(first, file))
          .join('\n');
        const result = checkIsolation(text, locale, segments, attributed);
        assert.deepEqual(result.missing, [], `${locale} strings missing`);
        assert.deepEqual(result.foreign, [], `foreign strings in ${locale}`);
      }
    });

    it('keeps no translations in shared files', () => {
      const segments = distinctiveSegments(translations, attributed);
      const text = first.report.shared
        .map((file) => read(first, file))
        .join('\n');
      const found = Object.entries(segments).flatMap(([locale, byHash]) =>
        Object.values(byHash)
          .flat()
          .filter((segment) => text.includes(segment))
          .map((segment) => `${locale}: ${segment}`)
      );
      assert.deepEqual(found, [], 'shared files hold translated strings');
    });

    it('keeps the source text of unattributed entries in code', () => {
      const { defaultLocale } = first.manifest;
      const unattributed = [...derivedEntryHashes(translations[defaultLocale])];
      assert.ok(unattributed.length > 0, 'the app has an unattributed control');
      for (const locale of first.manifest.locales) {
        const text = servedFiles(first.outDir, first.manifest, locale)
          .filter((file) => file.endsWith('.js'))
          .map((file) => read(first, file))
          .join('\n');
        for (const hash of unattributed) {
          for (const segment of textSegments(
            translations[defaultLocale][hash]
          )) {
            assert.ok(text.includes(segment), `${locale}: ${segment}`);
          }
        }
      }
    });

    it('rewrites documents to load the entry twin of each locale', () => {
      const { manifest } = first;
      for (const document of documents) {
        const html = read(first, document);
        const data = readTwinDocumentData(html);
        assert.equal(data.defaultLocale, manifest.defaultLocale);
        assert.deepEqual(
          [...data.locales].sort(),
          [...manifest.locales].sort()
        );
        const entryTag = data.tags.find((tag) => tag.tag === 'script');
        assert.ok(entryTag, 'the entry script is selected per locale');
        for (const locale of manifest.locales) {
          const twins = new Set(Object.values(manifest.twins[locale]));
          for (const tag of data.tags) {
            assert.ok(
              twins.has(
                new URL(tag.urls[locale], 'http://x/').pathname.slice(1)
              ),
              `${document}: ${tag.urls[locale]} is a ${locale} twin`
            );
          }
        }
        for (const original of manifest.twinned) {
          assert.ok(
            !html.includes(path.posix.basename(original)),
            `${document} names the original ${original}`
          );
        }
      }
    });

    it(
      'retranslating one string changes only that locale’s twin URLs (§9.7)',
      async () => {
        const { manifest, report } = first;
        const locale = manifest.locales.find(
          (candidate) => candidate !== manifest.defaultLocale
        )!;
        const translationsDir = makeTmpDir('gt-twins-translations-');
        for (const file of fs.readdirSync(options.translationsDir)) {
          fs.copyFileSync(
            path.join(options.translationsDir, file),
            path.join(translationsDir, file)
          );
        }
        const edited = { ...translations[locale] };
        const hash = [...attributed].find(
          (key) => typeof edited[key] === 'string'
        )!;
        edited[hash] = `${edited[hash] as string} (2)`;
        fs.writeFileSync(
          path.join(translationsDir, `${locale}.json`),
          JSON.stringify(edited, null, 2)
        );

        const second = await runBuild(translationsDir);

        assert.notEqual(
          second.manifest.versions[locale],
          manifest.versions[locale]
        );
        for (const [fileName, twin] of Object.entries(manifest.twins[locale])) {
          assert.notEqual(second.manifest.twins[locale][fileName], twin);
        }
        for (const other of manifest.locales.filter((l) => l !== locale)) {
          assert.equal(
            second.manifest.versions[other],
            manifest.versions[other]
          );
          assert.deepEqual(second.manifest.twins[other], manifest.twins[other]);
          for (const twin of Object.values(manifest.twins[other])) {
            assert.equal(read(second, twin), read(first, twin), twin);
          }
        }
        assert.deepEqual(second.report.shared, report.shared);
        for (const file of report.shared) {
          assert.equal(read(second, file), read(first, file), file);
        }
      },
      BUILD_TIMEOUT
    );
  });
}
