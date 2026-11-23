import type { SplitTranslationsOutput } from 'generaltranslation/internal';

/**
 * Replaced in the server build by the gt-tanstack-start Vite plugin with what
 * the compiler handed it of the client build, when the build splits
 * translations.
 */
export const table: SplitTranslationsOutput | undefined = undefined;

/**
 * The hashes of the `msg()` messages in the server's own code, which the
 * plugin writes in once the server build has compiled its modules.
 */
export const serverMessages: readonly string[] = [];
