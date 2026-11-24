/** The formats that are compared, and where the files of each cell live. */
import { fileURLToPath } from 'node:url';
import type { MixId } from './corpus.ts';

export const packageDir = fileURLToPath(new URL('..', import.meta.url));
/** Everything build.ts generates. Ignored by git (`tmp/` in the root .gitignore). */
export const workDir = `${packageDir}tmp`;

export type Format = {
  id: string;
  label: string;
  /** The call that formats a message. */
  runtime: string;
  parserAtRuntime: boolean;
  /** The module of src/runtimes that sets the library up. */
  module: string;
  /** The catalog file the format reads; two formats can read the same one. */
  wire: string;
  /** JSON is parsed; JavaScript is evaluated. */
  catalogType: 'json' | 'js';
  /**
   * What a user downloads does not depend on how many locales the app has:
   * each locale is its own file. Such a format is measured once and has cells
   * for one locale only.
   */
  localeInvariant: boolean;
  /** The id of the default setup that this is the per-locale setup of. */
  variantOf?: string;
};

export const FORMATS: Format[] = [
  {
    id: 'icu',
    label: 'ICU string, gt formatIcu',
    runtime: '@generaltranslation/icu/parser formatIcu',
    parserAtRuntime: true,
    module: 'icu',
    wire: 'icu',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'icu-fjs',
    label: 'ICU string, intl-messageformat',
    runtime:
      'intl-messageformat IntlMessageFormat (with @formatjs/icu-messageformat-parser)',
    parserAtRuntime: true,
    module: 'formatjs',
    wire: 'icu',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'fjs-ast',
    label: 'FormatJS precompiled AST',
    runtime:
      'intl-messageformat IntlMessageFormat given the AST of `formatjs compile --ast`',
    parserAtRuntime: false,
    module: 'formatjs',
    wire: 'fjs-ast',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'lingui',
    label: 'Lingui compiled message',
    runtime: '@lingui/core i18n._ (production build, no message compiler)',
    parserAtRuntime: false,
    module: 'lingui',
    wire: 'lingui',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'minify',
    label: 'next-intl icu-minify',
    runtime: 'icu-minify/format',
    parserAtRuntime: false,
    module: 'minify',
    wire: 'minify',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'tree',
    label: 'gt message tree',
    runtime: '@generaltranslation/icu formatMessageTree',
    parserAtRuntime: false,
    module: 'tree',
    wire: 'tree',
    catalogType: 'json',
    localeInvariant: true,
  },
  {
    id: 'paraglide',
    label: 'Paraglide JS compiled functions',
    runtime:
      'the message functions that @inlang/paraglide-js compiles (Vite plugin, default options)',
    parserAtRuntime: false,
    module: 'paraglide',
    wire: 'paraglide',
    catalogType: 'js',
    localeInvariant: false,
  },
  {
    id: 'paraglide-static',
    label: 'Paraglide JS, per-locale build',
    runtime:
      'the same functions, built for one locale (experimentalPerLocaleBuild)',
    parserAtRuntime: false,
    module: 'paraglide',
    wire: 'paraglide-static',
    catalogType: 'js',
    localeInvariant: true,
    variantOf: 'paraglide',
  },
  {
    id: 'intlayer',
    label: 'Intlayer dictionary',
    runtime:
      '@intlayer/core getDictionary and its ICU message resolver (static import mode)',
    parserAtRuntime: true,
    module: 'intlayer',
    wire: 'intlayer',
    catalogType: 'json',
    localeInvariant: false,
  },
  {
    id: 'intlayer-dynamic',
    label: 'Intlayer dictionary, dynamic import mode',
    runtime: 'the same calls on the per-locale dictionary',
    parserAtRuntime: true,
    module: 'intlayer',
    wire: 'intlayer-dynamic',
    catalogType: 'json',
    // Its per-locale file lists the id of every locale's source file.
    localeInvariant: false,
    variantOf: 'intlayer',
  },
];

/** The A/A control: `tree` measured a second time under another name. */
export const CONTROL = 'control';

export const formatOf = (id: string): Format => {
  const format = FORMATS.find(
    (candidate) => candidate.id === (id === CONTROL ? 'tree' : id)
  );
  if (!format) throw new Error(`unknown format ${id}`);
  return format;
};

/** The locale counts a format has cells for. */
export const localeCountsOf = (format: Format, counts: number[]): number[] =>
  format.localeInvariant ? [1] : counts;

const cellName = (format: Format, mix: MixId, n: number, locales: number) =>
  `${mix}-${n}${format.localeInvariant ? '' : `-L${locales}`}`;

/** The catalog a format loads in one cell, relative to `workDir`. */
export const catalogFile = (
  format: Format,
  mix: MixId,
  n: number,
  locales: number
): string =>
  `catalogs/${cellName(format, mix, n, locales)}-${format.wire}.${format.catalogType}`;

/**
 * The browser bundle of a format's runtime, relative to `workDir`. Intlayer's
 * is built by its own Vite plugin from the cell's configuration and
 * dictionary, so it has one per cell.
 */
export const harnessFile = (
  format: Format,
  mix: MixId,
  n: number,
  locales: number
): string =>
  format.module === 'intlayer'
    ? `harness/${cellName(format, mix, n, locales)}-${format.wire}.js`
    : `harness/${format.id === 'fjs-ast' ? 'fjs-ast' : format.module}.js`;
