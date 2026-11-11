import type { ImportAlias } from './alias.js';

export type ImportResolution = {
  aliases: readonly ImportAlias[];
  /** Where `/src/a.js` resolves from (Vite's root). */
  rootDirectory?: string;
};

export type ConfigFailure = { error: string };

export type ConfigContext = {
  /** Imports a package from the project; undefined if not installed. */
  load<T = unknown>(specifier: string): Promise<T | undefined>;
};

/** Reads a bundler's import aliases from its config, without running it. */
export type BundlerConfig = {
  name: string;
  /** Possible config file names. */
  files: readonly string[];
  /** `file` is absolute. A failure, returned or thrown, is reported and the config skipped. */
  read(
    file: string,
    context: ConfigContext
  ): Promise<ImportResolution | ConfigFailure>;
};
