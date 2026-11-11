import type { SourceLanguage } from './languages/language.js';
import type { ParaglideTarget } from './paraglide/targets.js';
import type { AutoImportOptions } from './project/auto-imports.js';

/** Options of every bundler plugin and of the CLI. */
export type ParaglideContextOptions = {
  /**
   * Paths or globs analyzed for usages, relative to the project root (the
   * nearest package.json at or above the bundler's root). Default: the whole project.
   * Files the bundler loads are analyzed too, wherever they are.
   */
  include?: string[];
  /** Paths or globs that are not analyzed. Default: `DEFAULT_EXCLUDE` (tests). */
  exclude?: string[];
  /** Default: `defaultTargets`. */
  targets?: readonly ParaglideTarget[];
  /** Non-JavaScript formats. Default: `defaultLanguages`. */
  languages?: readonly SourceLanguage[];
  /**
   * inlang project directories, relative to the project root. Each message
   * file of their base locale gets a metadata file next to it. Default: the
   * project each outdir's README names, else `*.inlang` directories in the
   * project root and above it, up to the monorepo root.
   */
  inlangProjects?: string[];
  /** Lines of context above and below each usage. Default: `10`. */
  radius?: number;
  /**
   * Paraglide outdirs to use without verifying them, relative to the project root.
   * Outdirs are detected without this; set it when detection rejects one.
   */
  outdirs?: string[];
  /**
   * Names used without an import, e.g. `{ m: "./src/paraglide/messages.js" }`.
   * unplugin-auto-import and Nuxt auto-imports are detected; `false` disables both.
   */
  autoImports?: false | AutoImportOptions;
  /** Default: off in test runners (Vitest, `NODE_ENV=test`), on otherwise. */
  enabled?: boolean;
};
