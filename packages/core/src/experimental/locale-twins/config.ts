/**
 * How a project's translations are divided into units the browser downloads.
 * - `'locale'` (default): each unit is one whole locale.
 * - `'locale-twins'`: the build emits a per-locale copy of every chunk that
 *   carries entries, holding only that locale's entries for the chunk.
 */
export type TranslationSplittingStrategy = 'locale' | 'locale-twins';

/** Experimental gt.config.json settings, under `experimental`. */
export type GTExperimentalConfig = {
  /**
   * Translation splitting strategy. Defaults to `'locale'`. Any string is
   * accepted so an imported gt.config.json (whose JSON strings widen to
   * `string`) typechecks; the compiler rejects unknown values with
   * `resolveTranslationSplitting`.
   */
  splitting?: TranslationSplittingStrategy | (string & {});
};

/**
 * The experimental part of a gt.config.json object (`GTConfig` has no
 * `experimental` field). Runtime configs that apps spread gt.config.json into
 * add it with an intersection.
 */
export type GTExperimentalSettings = {
  /** Experimental features. They can change or go away in any release. */
  experimental?: GTExperimentalConfig;
};
