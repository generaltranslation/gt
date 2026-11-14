import type { CustomMapping } from '@generaltranslation/format';
import type { InferInput, ObjectEntries, ObjectSchema } from 'valibot';
import type {
  GTConfigSchema,
  GTFilesConfigSchema,
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
