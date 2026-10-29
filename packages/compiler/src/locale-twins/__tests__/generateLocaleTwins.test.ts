import { describe, expect, it } from 'vitest';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import MagicString from 'magic-string';
import {
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
} from 'generaltranslation/internal';
import { generateLocaleTwins } from '../generateLocaleTwins';

const HASH_A = 'aaaaaaaaaaaaaaaa';
const HASH_MAIN = 'cccccccccccccccc';
const HASH_SHARED = '0123456789abcdef';

/**
 * Client output shaped like Vite 8 / Rolldown (backtick literals, `from"./x.js"`,
 * `__vite__mapDeps` with base-relative paths), modelled on a real probe build:
 * entry → lazy pages a and b; a and b → shared (placeholder) and vendor.
 * Page b has no strings of its own.
 */
function rolldownOutput(): Record<string, { code: string }> {
  const main = encodeLocaleTwinPlaceholder({ [HASH_MAIN]: 'Main text' });
  const a = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Page A text' });
  const shared = encodeLocaleTwinPlaceholder({
    [HASH_SHARED]: 'Shared string',
  });
  return {
    'assets/index-DGIdfwLW.js': {
      code:
        'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/a-C7otXMrN.js","assets/vendor-aFRhfiVc.js","assets/shared-CO9IKj5Z.js","assets/shared-a9zuq20O.css","assets/b-Bfkmz0Sr.js"])))=>i.map(i=>d[i]);\n' +
        'import{n as e,r as t}from"./vendor-aFRhfiVc.js";' +
        `var o=e(\`${main}\`),c={a:()=>a(()=>import(\`./a-C7otXMrN.js\`),__vite__mapDeps([0,1,2,3])),b:()=>a(()=>import(\`./b-Bfkmz0Sr.js\`),__vite__mapDeps([4,1,2,3]))};\n` +
        '//# sourceMappingURL=index-DGIdfwLW.js.map',
    },
    'assets/a-C7otXMrN.js': {
      code:
        'import{n as e,r as t}from"./vendor-aFRhfiVc.js";import{t as n}from"./shared-CO9IKj5Z.js";' +
        `var r=e(\`${a}\`);function i(e){t(e,n()+r)}export{i as default};\n` +
        '//# sourceMappingURL=a-C7otXMrN.js.map',
    },
    'assets/b-Bfkmz0Sr.js': {
      code:
        'import{n as e,r as t}from"./vendor-aFRhfiVc.js";import{t as n}from"./shared-CO9IKj5Z.js";' +
        'function i(e){t(e,n())}export{i as default};\n' +
        '//# sourceMappingURL=b-Bfkmz0Sr.js.map',
    },
    'assets/shared-CO9IKj5Z.js': {
      code:
        'import{n as e,t}from"./vendor-aFRhfiVc.js";' +
        `var n=e(\`${shared}\`);function r(){return t(\`x\`)+n.length}export{r as t};\n` +
        '//# sourceMappingURL=shared-CO9IKj5Z.js.map',
    },
    'assets/vendor-aFRhfiVc.js': {
      code: 'function n(e){return e}function r(e,t){e.textContent=t}function t(e){return e}export{n,r,t};\n',
    },
  };
}

/**
 * Client output shaped like Vite 7 / Rollup + esbuild minify: placeholders in
 * single quotes, `import("./x.js")` and `from"./x.js"` in double quotes.
 */
function rollupOutput(): Record<string, { code: string }> {
  const main = encodeLocaleTwinPlaceholder({ [HASH_MAIN]: 'Main text' });
  const a = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Page A text' });
  return {
    'assets/index-uTNh2gR5.js': {
      code:
        'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/a-DzZqmkhL.js","assets/vendor-BM75T8Fc.js"])))=>i.map(i=>d[i]);\n' +
        'import{r as g,a as E}from"./vendor-BM75T8Fc.js";' +
        `const b=g('${main}'),p={a:()=>m(()=>import("./a-DzZqmkhL.js"),__vite__mapDeps([0,1]))};E(document.body,b);\n`,
    },
    'assets/a-DzZqmkhL.js': {
      code:
        'import{a as e,r}from"./vendor-BM75T8Fc.js";' +
        `const s=r("${a}");function f(a){e(a,s)}export{f as default};\n`,
    },
    'assets/vendor-BM75T8Fc.js': {
      code: 'function r(e){return e}function a(e,t){e.textContent=t}export{r,a};\n',
    },
  };
}

/** The JS literal a filled placeholder becomes: a string holding the table JSON. */
function filled(locale: string, entries: Record<string, unknown>): string {
  return JSON.stringify(JSON.stringify({ l: locale, e: entries }));
}

describe('generateLocaleTwins', () => {
  it('writes one twin per locale with that locale’s table in place of the placeholder', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Page A' });
    const result = generateLocaleTwins({
      files: {
        'assets/a-C7otXMrN.js': { code: `var r=e(\`${placeholder}\`);` },
      },
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: { fr: { [HASH_A]: 'Page A en français' } },
    });

    const { twins } = result.manifest;
    const frName = twins.fr['assets/a-C7otXMrN.js'];
    const enName = twins.en['assets/a-C7otXMrN.js'];
    expect(result.files[frName]).toBe(
      `var r=e(${filled('fr', { [HASH_A]: 'Page A en français' })});`
    );
    expect(result.files[enName]).toBe(
      `var r=e(${filled('en', { [HASH_A]: 'Page A' })});`
    );
  });

  it('twins every file with a placeholder and every file that references a twinned file', () => {
    const result = generateLocaleTwins({
      files: rolldownOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: { fr: {} },
    });

    expect(result.manifest.twinned).toEqual([
      'assets/a-C7otXMrN.js',
      'assets/b-Bfkmz0Sr.js',
      'assets/index-DGIdfwLW.js',
      'assets/shared-CO9IKj5Z.js',
    ]);
    expect(result.report.shared).toEqual(['assets/vendor-aFRhfiVc.js']);
  });

  it('names twins <name>.<locale>-<version>.js next to the original', () => {
    const { manifest } = generateLocaleTwins({
      files: rolldownOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: { fr: {} },
    });

    expect(manifest.versions.fr).toMatch(/^[0-9a-f]{8}$/);
    expect(manifest.twins.fr['assets/a-C7otXMrN.js']).toBe(
      `assets/a-C7otXMrN.fr-${manifest.versions.fr}.js`
    );
  });

  it('renames static imports, dynamic imports and preload lists to same-locale twins', () => {
    const { files, manifest } = generateLocaleTwins({
      files: rolldownOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: { fr: {} },
    });
    const v = manifest.versions.fr;
    const index = files[manifest.twins.fr['assets/index-DGIdfwLW.js']];
    const pageA = files[manifest.twins.fr['assets/a-C7otXMrN.js']];

    expect(index).toContain(
      `m.f=["assets/a-C7otXMrN.fr-${v}.js","assets/vendor-aFRhfiVc.js","assets/shared-CO9IKj5Z.fr-${v}.js","assets/shared-a9zuq20O.css","assets/b-Bfkmz0Sr.fr-${v}.js"]`
    );
    expect(index).toContain(`import(\`./a-C7otXMrN.fr-${v}.js\`)`);
    expect(index).toContain(`import(\`./b-Bfkmz0Sr.fr-${v}.js\`)`);
    expect(pageA).toContain(
      `import{n as e,r as t}from"./vendor-aFRhfiVc.js";import{t as n}from"./shared-CO9IKj5Z.fr-${v}.js";`
    );
  });

  it('gives each locale a closed set of twins: only same-locale twins and shared files', () => {
    const { files, manifest, report } = generateLocaleTwins({
      files: rolldownOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr', 'zh'],
      translations: { fr: {}, zh: {} },
    });

    for (const locale of manifest.locales) {
      const allowed = new Set([
        ...report.shared.map((name) => name.split('/').pop()),
        ...Object.values(manifest.twins[locale]).map((name) =>
          name.split('/').pop()
        ),
      ]);
      for (const twin of Object.values(manifest.twins[locale])) {
        const referenced = files[twin].match(/[\w.-]+\.js(?=['"`])/g) ?? [];
        expect(referenced.length).toBeGreaterThan(0);
        for (const name of referenced) expect(allowed).toContain(name);
        expect(findLocaleTwinPlaceholders(files[twin])).toEqual([]);
      }
    }
  });

  it('accepts single- and double-quoted placeholders and imports (Vite 7 / esbuild)', () => {
    const { files, manifest, report } = generateLocaleTwins({
      files: rollupOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: {
        fr: { [HASH_MAIN]: 'Texte principal', [HASH_A]: 'Texte A' },
      },
    });
    const v = manifest.versions.fr;
    const index = files[manifest.twins.fr['assets/index-uTNh2gR5.js']];
    const pageA = files[manifest.twins.fr['assets/a-DzZqmkhL.js']];

    expect(report.shared).toEqual(['assets/vendor-BM75T8Fc.js']);
    expect(index).toContain(
      `const b=g(${filled('fr', { [HASH_MAIN]: 'Texte principal' })})`
    );
    expect(index).toContain(`import("./a-DzZqmkhL.fr-${v}.js")`);
    expect(index).toContain(`m.f=["assets/a-DzZqmkhL.fr-${v}.js",`);
    expect(pageA).toContain(
      `const s=r(${filled('fr', { [HASH_A]: 'Texte A' })})`
    );
  });

  it('falls back to the source text for missing translations and reports them per locale', () => {
    const { files, manifest, report } = generateLocaleTwins({
      files: rolldownOutput(),
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ja'],
      translations: {
        fr: { [HASH_MAIN]: 'Texte principal', [HASH_SHARED]: 'Texte partagé' },
      },
    });

    expect(files[manifest.twins.fr['assets/a-C7otXMrN.js']]).toContain(
      filled('fr', { [HASH_A]: 'Page A text' })
    );
    expect(report.missingTranslations).toEqual({
      fr: [HASH_A],
      ja: [HASH_A, HASH_SHARED, HASH_MAIN].sort(),
    });
  });

  it("throws a compiler diagnostic for missing translations under the 'error' policy", () => {
    const generate = () =>
      generateLocaleTwins({
        files: rolldownOutput(),
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        translations: {
          fr: { [HASH_MAIN]: 'Texte principal', [HASH_SHARED]: 'Texte' },
        },
        missingTranslations: 'error',
      });

    expect(generate).toThrow('@generaltranslation/compiler');
    expect(generate).toThrow(HASH_A);
    expect(generate).toThrow(/\bfr\b/);
  });

  it('versions per locale: retranslating one string re-versions only that locale', () => {
    const translations = {
      fr: { [HASH_MAIN]: 'Principal', [HASH_A]: 'A', [HASH_SHARED]: 'Partagé' },
      zh: { [HASH_MAIN]: '主要', [HASH_A]: '甲', [HASH_SHARED]: '共享' },
    };
    const build = (fr: typeof translations.fr) =>
      generateLocaleTwins({
        files: rolldownOutput(),
        defaultLocale: 'en',
        locales: ['en', 'fr', 'zh'],
        translations: { ...translations, fr },
      }).manifest;

    const before = build(translations.fr);
    const same = build({ ...translations.fr });
    const after = build({ ...translations.fr, [HASH_A]: 'A (révisé)' });

    expect(same).toEqual(before);
    expect(after.versions.fr).not.toBe(before.versions.fr);
    expect(after.twins.en).toEqual(before.twins.en);
    expect(after.twins.zh).toEqual(before.twins.zh);
    for (const original of before.twinned) {
      expect(after.twins.fr[original]).not.toBe(before.twins.fr[original]);
    }
    expect(new Set(Object.values(before.versions)).size).toBe(3);
  });

  it('handles import cycles: both chunks of a cycle are twinned and point at each other’s twin', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Cycle' });
    const { files, manifest } = generateLocaleTwins({
      files: {
        'assets/x-1.js': {
          code: `import{b}from"./y-2.js";export const a=t(\`${placeholder}\`);`,
        },
        'assets/y-2.js': {
          code: 'import{a}from"./x-1.js";export const b=()=>a;',
        },
        'assets/z-3.js': { code: 'export const unrelated=1;' },
      },
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: { fr: { [HASH_A]: 'Cycle (fr)' } },
    });
    const v = manifest.versions.fr;

    expect(manifest.twinned).toEqual(['assets/x-1.js', 'assets/y-2.js']);
    expect(files[`assets/x-1.fr-${v}.js`]).toContain(`from"./y-2.fr-${v}.js"`);
    expect(files[`assets/y-2.fr-${v}.js`]).toBe(
      `import{a}from"./x-1.fr-${v}.js";export const b=()=>a;`
    );
  });

  it('lists the twinned entry chunks in the manifest', () => {
    const files = {
      ...rolldownOutput(),
      'assets/worker-entry-1.js': { code: 'export{}' },
    };
    const { manifest } = generateLocaleTwins({
      files,
      entries: ['assets/worker-entry-1.js', 'assets/index-DGIdfwLW.js'],
      defaultLocale: 'en',
      locales: ['en'],
      translations: {},
    });

    expect(manifest.entries).toEqual(['assets/index-DGIdfwLW.js']);
  });

  it('reports placeholders, per-locale twin bytes and the output multiplier', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Hi' });
    const vendor = 'export const v=1;'; // 17 bytes, shared
    const { report } = generateLocaleTwins({
      files: {
        'assets/a-1.js': {
          code: `e(\`${placeholder}\`);e(\`${placeholder}\`);`,
        },
        'assets/vendor-2.js': { code: vendor },
        'assets/style-3.css': { code: 'body{}' },
      },
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      translations: { ja: { [HASH_A]: 'こんにちは' } },
    });
    const en = `e(${filled('en', { [HASH_A]: 'Hi' })});`.repeat(2);
    const ja = `e(${filled('ja', { [HASH_A]: 'こんにちは' })});`.repeat(2);
    const original = `e(\`${placeholder}\`);`.repeat(2);
    const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

    expect(report.placeholders).toBe(2);
    expect(report.sharedBytes).toBe(17);
    expect(report.twinnedBytes).toBe(bytes(original));
    expect(report.twinBytes).toEqual({ en: bytes(en), ja: bytes(ja) });
    expect(report.outputMultiplier).toBeCloseTo(
      (17 + bytes(en) + bytes(ja)) / (17 + bytes(original))
    );
  });

  it('fills the default locale from the placeholder’s source text, not a translation file', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Source' });
    const { files, manifest } = generateLocaleTwins({
      files: { 'assets/a-1.js': { code: `e('${placeholder}')` } },
      defaultLocale: 'en',
      locales: ['fr'],
      translations: {
        en: { [HASH_A]: 'Stale' },
        fr: { [HASH_A]: 'Source fr' },
      },
    });

    expect(manifest.locales).toEqual(['en', 'fr']);
    expect(files[manifest.twins.en['assets/a-1.js']]).toBe(
      `e(${filled('en', { [HASH_A]: 'Source' })})`
    );
  });

  it('resolves references by path when two chunks share a basename', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'A' });
    const { files, manifest } = generateLocaleTwins({
      files: {
        'assets/page.js': { code: `e('${placeholder}')` },
        'assets/nested/page.js': { code: 'export{}' },
        'assets/entry.js': {
          code: 'import"./page.js";import"./nested/page.js";',
        },
      },
      defaultLocale: 'en',
      locales: ['en'],
      translations: {},
    });
    const v = manifest.versions.en;

    expect(manifest.twinned).toEqual(['assets/entry.js', 'assets/page.js']);
    expect(files[`assets/entry.en-${v}.js`]).toBe(
      `import"./page.en-${v}.js";import"./nested/page.js";`
    );
  });

  it('rejects locales that cannot be used in a file name', () => {
    expect(() =>
      generateLocaleTwins({
        files: rolldownOutput(),
        defaultLocale: 'en',
        locales: ['en', '../fr'],
        translations: {},
      })
    ).toThrow(/@generaltranslation\/compiler.*\.\.\/fr/s);
  });

  describe('source maps', () => {
    /** A chunk built from a multi-line source, with the bundler's map. */
    function chunkWithMap() {
      const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Page A' });
      const source =
        `const label = register(\`${placeholder}\`), other = 1;\n` +
        'export default function pageA(el) {\n' +
        '  render(el, label + other);\n' +
        '}\n';
      const chunk = new MagicString(source);
      chunk.prepend('import{register,render}from"./x-1.js";\n');
      chunk.append('//# sourceMappingURL=a-C7otXMrN.js.map');
      const map = chunk.generateMap({
        hires: true,
        source: '../src/pages/a.js',
        file: 'a-C7otXMrN.js',
        includeContent: true,
      });
      return { code: chunk.toString(), map: map.toString() };
    }

    /** Original source position of the first occurrence of `token` in `code`. */
    function originalOf(code: string, map: string, token: string) {
      const offset = code.indexOf(token);
      const lines = code.slice(0, offset).split('\n');
      return originalPositionFor(new TraceMap(map), {
        line: lines.length,
        column: lines[lines.length - 1].length,
      });
    }

    it('writes a twin map that traces twin code back to the original sources', () => {
      const original = chunkWithMap();
      const { files, manifest } = generateLocaleTwins({
        files: {
          'assets/a-C7otXMrN.js': original,
          'assets/x-1.js': { code: 'export{}' },
        },
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        translations: { fr: { [HASH_A]: 'Page A, mais beaucoup plus long' } },
      });
      const twinName = manifest.twins.fr['assets/a-C7otXMrN.js'];
      const twin = files[twinName];
      const twinMap = files[`${twinName}.map`];

      expect(
        twin.endsWith(`//# sourceMappingURL=${twinName.slice(7)}.map`)
      ).toBe(true);
      expect(JSON.parse(twinMap)).toMatchObject({
        file: twinName.slice(7),
        sources: ['../src/pages/a.js'],
      });
      for (const token of ['other = 1', 'render(el', 'label + other']) {
        expect(originalOf(twin, twinMap, token)).toEqual(
          originalOf(original.code, original.map, token)
        );
      }
      expect(originalOf(twin, twinMap, 'render(el')).toMatchObject({
        source: '../src/pages/a.js',
        line: 3,
        column: 2,
      });
    });

    it('keeps inline maps inline', () => {
      const original = chunkWithMap();
      const inlineUrl = `data:application/json;base64,${Buffer.from(original.map).toString('base64')}`;
      const code = original.code.replace('a-C7otXMrN.js.map', inlineUrl);
      const { files, manifest } = generateLocaleTwins({
        files: { 'assets/a-C7otXMrN.js': { code, map: original.map } },
        defaultLocale: 'en',
        locales: ['en'],
        translations: {},
      });
      const twinName = manifest.twins.en['assets/a-C7otXMrN.js'];
      const twin = files[twinName];
      const twinMap = Buffer.from(
        /base64,(\S+)$/.exec(twin)![1],
        'base64'
      ).toString('utf8');

      expect(files[`${twinName}.map`]).toBeUndefined();
      expect(originalOf(twin, twinMap, 'render(el')).toMatchObject({
        line: 3,
        column: 2,
      });
    });

    it('writes no map and drops the map comment when the original has no map', () => {
      const { code } = chunkWithMap();
      const { files, manifest } = generateLocaleTwins({
        files: { 'assets/a-C7otXMrN.js': { code } },
        defaultLocale: 'en',
        locales: ['en'],
        translations: {},
      });
      const twinName = manifest.twins.en['assets/a-C7otXMrN.js'];

      expect(files[`${twinName}.map`]).toBeUndefined();
      expect(files[twinName]).not.toContain('sourceMappingURL');
    });
  });

  describe('re-running on the same output', () => {
    const input = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      translations: {
        fr: { [HASH_MAIN]: 'Principal', [HASH_A]: 'A', [HASH_SHARED]: 'P' },
      },
    };

    it('produces the same files and deletes nothing, even when given its own twins back', () => {
      const first = generateLocaleTwins({ ...input, files: rolldownOutput() });
      const outDir = { ...rolldownOutput() };
      for (const [fileName, code] of Object.entries(first.files)) {
        outDir[fileName] = { code };
      }

      const second = generateLocaleTwins({
        ...input,
        files: outDir,
        previousManifest: first.manifest,
      });

      expect(second.files).toEqual(first.files);
      expect(second.manifest).toEqual(first.manifest);
      expect(second.deletions).toEqual([]);
    });

    it('deletes only stale twins listed in the previous manifest', () => {
      const first = generateLocaleTwins({ ...input, files: rolldownOutput() });
      const staleA = first.manifest.twins.fr['assets/a-C7otXMrN.js'];
      const outDir = {
        ...rolldownOutput(),
        [staleA]: { code: first.files[staleA] },
        'assets/a-C7otXMrN.fr-userfile.js': { code: 'export{}' },
      };

      const second = generateLocaleTwins({
        ...input,
        translations: { fr: { ...input.translations.fr, [HASH_A]: 'A2' } },
        files: outDir,
        previousManifest: first.manifest,
      });

      const staleFr = Object.values(first.manifest.twins.fr);
      expect(second.deletions).toEqual(
        staleFr.flatMap((name) => [name, `${name}.map`]).sort()
      );
      expect(second.deletions).not.toContain(
        'assets/a-C7otXMrN.fr-userfile.js'
      );
      for (const name of Object.values(first.manifest.twins.en)) {
        expect(second.files[name]).toBe(first.files[name]);
      }
    });
  });
});
