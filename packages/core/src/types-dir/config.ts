import type { CustomMapping } from '@generaltranslation/format';
import type { InferInput, ObjectEntries, ObjectSchema } from 'valibot';
import type {
  GTConfigSchema,
  GTFilesConfigSchema,
  GTInlineTranslationsSchema,
  GTOutputFileConfigSchema,
  GTParsingFlagsSchema,
} from '../config/schema';

// The loose schemas accept unknown keys, but their types list only known keys:
// an index signature would make Omit and Pick drop every known key.
type KnownKeys<TSchema extends { entries: ObjectEntries }> = InferInput<
  ObjectSchema<TSchema['entries'], undefined>
>;

/**
 * Options shared by the CLI, compiler, and runtimes under
 * `files.gt.parsingFlags` in gt.config.json.
 */
export type GTParsingFlags = KnownKeys<typeof GTParsingFlagsSchema>;

/**
 * Options that framework integrations, such as gt-next and gt-tanstack-start,
 * pass through to the @generaltranslation/compiler plugin.
 */
export type GTCompilerOptions = {
  /**
   * Log level for the compiler plugin.
   * @default 'warn'
   */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  /**
   * Whether to compute translation hashes at build time.
   * @default true
   */
  compileTimeHash?: boolean;
  /**
   * Whether to disable the build checks for dynamic content.
   * @default false
   */
  disableBuildChecks?: boolean;
  /**
   * Whether to wrap translatable JSX automatically, for example
   * `<div>Hello</div>` becomes `<div><T>Hello</T></div>`. Defaults to false,
   * or to gt.config.json's `files.gt.parsingFlags.enableAutoJsxInjection` in
   * integrations that pass the config to the compiler, such as
   * gt-tanstack-start.
   */
  enableAutoJsxInjection?: boolean;
};

/**
 * Experimental: embed translations for the given locales directly at their
 * call sites, so bundlers tree-shake them with unused code. Translations are
 * read from `files.gt.output`. Other locales keep loading at runtime. Only
 * applied to production builds.
 *
 * Embedded call sites, with either the babel compiler or gt-next's SWC plugin:
 * - `<T>`, except derive content.
 * - The `t` from `/unstable`, and the `gt` from `const gt = useGT()` or
 *   `const gt = await getGT()` from `/unstable`, when every value in the
 *   template is a named variable like `${{ name }}` and options are literals,
 *   like gt({ context: 'button' })`Save`.
 *
 * Everything else loads at runtime: stable `gt()` and `t()`, `msg()` (resolved
 * by `m()` away from its call site), and other unstable templates, such as
 * ones with unnamed values, `plural()` and other helpers, `part`, or
 * `derive()`, or called through an alias or a configured tag. For embedded
 * locales, have your `loadTranslations` load the `msgOutput` file the CLI
 * writes instead of the full translations file: it has every entry except
 * the embedded ones.
 *
 * `<T>` with spread props or a `$_hash` prop, and call sites in files the
 * compiler leaves untransformed (such as a file with a non-extractable
 * argument like `gt(someVar)` under `disableBuildChecks`), are not embedded,
 * but the CLI still leaves those `<T>` out of `msgOutput` files.
 */
export type GTInlineTranslationsOptions = InferInput<
  typeof GTInlineTranslationsSchema
>;

/** Configuration for generated GT translation files. */
export type GTOutputFileConfig = InferInput<typeof GTOutputFileConfigSchema>;

/**
 * File configuration is primarily consumed by the CLI. Other packages only
 * inspect `files.gt`, but must still accept the complete gt.config.json shape.
 */
export type GTFilesConfig = InferInput<typeof GTFilesConfigSchema>;

/**
 * The configuration stored in gt.config.json. All settings are optional.
 * `dictionary` is left out: the file holds a path, but runtime params hold the
 * loaded dictionary, and a GTConfig must still pass to initializeGT().
 */
export type GTConfig = Omit<
  KnownKeys<typeof GTConfigSchema>,
  'dictionary' | 'customMapping'
> & {
  // The schema only checks JSON shapes; the type names the locale properties.
  customMapping?: CustomMapping;
};
