/**
 * Locale twin placeholders must survive real minifiers: each call site's
 * placeholder stays a string literal argument or prop value the twin
 * generator can find (whatever quote style the minifier picks), and the
 * filled twin behaves like the unminified one. The page and a runtime that
 * reads the markers are bundled together, so the minifiers see the callees
 * (a bundler drops arguments a visible callee never reads, and may inline
 * small functions).
 */
import { minify as terser } from 'terser';
import { describe, expect, it } from 'vitest';
import type { TransformResult } from 'unplugin';
import * as vite8 from 'vite';
import { findLocaleTwinPlaceholders } from 'generaltranslation/internal';
import type { Content } from 'generaltranslation/types';
import gtUnplugin from '../../index';
import { generateLocaleTwins } from '../generateLocaleTwins';

/** A page as Vite hands it to the GT compiler: every API, one unattributed entry. */
const PAGE = `import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Var, Derive, useGT, msg, useMessages, t } from 'gt-react';
const greeting = msg("Hello {name}", { name: "Ada" });
const getName = () => "Grace";
export function render(name) {
  const gt = useGT();
  const m = useMessages();
  return [
    jsxs(T, { children: ["Hi ", jsx("b", { children: "there" }), jsx(Var, { children: name })] }),
    gt("Save {count} items", { count: 3 }),
    m(greeting),
    t('Cancel'),
    gt(\`It's "quoted"\`),
    jsxs(T, { children: ["Dear ", jsx(Derive, { children: getName() })] }),
  ].join("|");
}`;

/**
 * Stands in for gt-react and React: renders each call site's locale twin
 * marker (`[locale, content]`, or `0` for the source text).
 */
const RUNTIME = `function show(marker, source) {
  if (Array.isArray(marker)) return marker[0] + "=" + JSON.stringify(marker[1]);
  return (marker === 0 ? "source=" : "unmarked=") + JSON.stringify(source);
}
export function jsx(type, props) {
  return typeof type === "function" ? type(props) : { type, props };
}
export const jsxs = jsx;
export function T(props) { return show(props._twin, props.children); }
export function Var(props) { return props.children; }
export function Derive(props) { return props.children; }
export function useGT() {
  return (message, options) => show(options && options.$_twin, message);
}
export function t(message, options) { return show(options && options.$_twin, message); }
export function msg(message, options) { return { message, options }; }
export function useMessages() {
  return (value) => show(value.options && value.options.$_twin, value.message);
}`;

const LOCALES = ['en', 'fr', 'ja'];

let compiledPage: Promise<string> | undefined;

/** The page compiled for a locale twin client build. */
function compilePage(): Promise<string> {
  compiledPage ??= (async () => {
    const plugin = gtUnplugin.raw(
      {
        logLevel: 'silent',
        gtConfig: {
          defaultLocale: 'en',
          locales: LOCALES,
          files: {
            gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' },
          },
        },
      },
      { framework: 'vite' }
    );
    const result = (await (
      plugin.transform as (
        this: unknown,
        code: string,
        id: string
      ) => Promise<TransformResult>
    ).call(
      {
        warn() {},
        error(message: unknown) {
          throw new Error(String(message));
        },
        environment: {
          name: 'client',
          mode: 'build',
          config: { consumer: 'client' },
        },
      },
      PAGE,
      '/src/page.js'
    ))!;
    return typeof result === 'string' ? result : result.code;
  })();
  return compiledPage;
}

const MODULES: Record<string, () => Promise<string>> = {
  'virtual:page': compilePage,
  'gt-react': async () => RUNTIME,
  'react/jsx-runtime': async () => RUNTIME,
};

/** Bundles the compiled page and the runtime into one CommonJS chunk. */
async function bundle(
  vite: Pick<typeof vite8, 'build'>,
  minify: boolean | 'esbuild'
): Promise<string> {
  const output = (await vite.build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'page-and-runtime',
        resolveId: (id: string) => (id in MODULES ? `\0${id}` : null),
        load: (id: string) =>
          id.startsWith('\0') && id.slice(1) in MODULES
            ? MODULES[id.slice(1)]()
            : null,
      },
    ],
    build: {
      write: false,
      minify,
      rollupOptions: {
        input: 'virtual:page',
        preserveEntrySignatures: 'strict',
        output: { format: 'cjs' },
      },
    },
  })) as vite8.Rolldown.RolldownOutput | vite8.Rolldown.RolldownOutput[];
  const [chunk] = (Array.isArray(output) ? output[0] : output).output;
  return (chunk as { code: string }).code;
}

/** Translations: the source content behind a locale tag. */
function translate(locale: string, source: Content): Content {
  return typeof source === 'string'
    ? `[${locale}] ${source}`
    : [`[${locale}] `, ...(source as unknown[])];
}

function translationsFor(
  code: string
): Record<string, Record<string, Content>> {
  const translations: Record<string, Record<string, Content>> = {};
  for (const locale of LOCALES.slice(1)) {
    translations[locale] = Object.fromEntries(
      findLocaleTwinPlaceholders(code).map(({ hash, source }) => [
        hash,
        translate(locale, source),
      ])
    );
  }
  // ja lacks one translation: its twin carries the source text in "en"
  delete translations.ja[findLocaleTwinPlaceholders(code)[0].hash];
  return translations;
}

/** Each locale's twin of the bundle, run: what `render("Ada")` returns. */
function renderTwins(code: string): Record<string, string> {
  const result = generateLocaleTwins({
    files: { 'page.js': { code } },
    defaultLocale: 'en',
    locales: LOCALES,
    translations: translationsFor(code),
  });
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const twin = result.files[result.manifest.twins[locale]['page.js']];
      expect(findLocaleTwinPlaceholders(twin)).toEqual([]);
      const module = { exports: {} as { render(name: string): string } };
      new Function('module', 'exports', twin)(module, module.exports);
      return [locale, module.exports.render('Ada')];
    })
  );
}

const MINIFIERS: Array<[string, () => Promise<string>]> = [
  ['Rolldown with the Oxc minifier (Vite 8)', () => bundle(vite8, true)],
  [
    'Rollup with the esbuild minifier (Vite 7)',
    async () => bundle(await import('vite7'), 'esbuild'),
  ],
  [
    'Terser (compress with 2 passes, mangle, top level)',
    async () =>
      (await terser(await bundle(vite8, false), {
        compress: { passes: 2, toplevel: true, unsafe: true },
        mangle: { toplevel: true },
      }))!.code!,
  ],
];

describe('locale twin placeholders through minifiers', () => {
  it('the unminified reference renders each locale from its twin', async () => {
    const twins = renderTwins(await bundle(vite8, false));

    expect(twins.fr.split('|')).toEqual([
      'fr=["[fr] ","Hi ",{"t":"b","i":1,"c":"there"},{"i":2,"k":"_gt_value_2","v":"v"}]',
      'fr="[fr] Save {count} items"',
      'fr="[fr] Hello {name}"',
      'fr="[fr] Cancel"',
      `fr=${JSON.stringify(`[fr] It's "quoted"`)}`,
      'source=["Dear ","Grace"]',
    ]);
    expect(twins.en).toContain('en="Save {count} items"');
    // ja lacks one translation: that call site renders the source, in "en"
    const ja = twins.ja.split('|');
    const fallbacks = ja.filter((item) => item.startsWith('en='));
    expect(fallbacks).toHaveLength(1);
    expect(twins.en.split('|')[ja.indexOf(fallbacks[0])]).toBe(fallbacks[0]);
    expect(ja.filter((item) => item.startsWith('ja='))).toHaveLength(4);
  });

  it.each(MINIFIERS)(
    '%s keeps every placeholder findable and the twins equivalent',
    async (_name, minified) => {
      const reference = await bundle(vite8, false);
      const code = await minified();

      expect(code.length).toBeLessThan(reference.length);
      expect(
        findLocaleTwinPlaceholders(code)
          .map(({ hash }) => hash)
          .sort()
      ).toEqual(
        findLocaleTwinPlaceholders(reference)
          .map(({ hash }) => hash)
          .sort()
      );
      expect(renderTwins(code)).toEqual(renderTwins(reference));
    },
    60_000
  );
});
