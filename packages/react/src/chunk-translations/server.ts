import type {
  SplitTranslationsOutput,
  SplitTranslationsState,
} from 'generaltranslation/internal';
import type { ChunkTranslationsSeed } from './seed';

type Page = {
  /**
   * The files of the client chunks the response loads, as the build names
   * them: their path from the build's base. Every chunk of the build, when
   * the framework cannot tell.
   */
  chunks: readonly string[];
  /**
   * The URL the build's files are served from, when the app serves them
   * from another than the build's base, as from a CDN
   */
  base: string | undefined;
};

function findEntry(
  output: SplitTranslationsOutput,
  chunks: readonly string[]
): SplitTranslationsOutput['entries'][string] | undefined {
  const { entries } = output;
  return entries[
    chunks.find((chunk) => entries[chunk]) ?? Object.keys(entries)[0]
  ];
}

const getState = (
  state: SplitTranslationsState,
  base: string | undefined
): SplitTranslationsState =>
  base === undefined ? state : { ...state, b: base };

const pick = <T>(
  record: Record<string, T> | undefined,
  locale: string
): Record<string, T> =>
  record?.[locale] === undefined ? {} : { [locale]: record[locale] };

/**
 * What a page rendered for one request is seeded with: the translations of
 * the entry, of the imports of `chunks`, and of the unsplit messages, read
 * from the locale's catalog. Undefined when the build has no files for the
 * locale, as for the default one: the page then takes its translations as it
 * does without the split.
 *
 * @param output What the compiler handed the framework's plugin.
 * @param page.locale The locale of the response.
 * @param page.translations The locale's catalog, by hash, as the server loaded it.
 */
export function createChunkTranslationsSeed(
  output: SplitTranslationsOutput,
  {
    locale,
    translations,
    chunks,
    base,
  }: Page & { locale: string; translations: Record<string, unknown> }
): ChunkTranslationsSeed | undefined {
  const entry = findEntry(output, chunks);
  if (!entry || entry.state.h[locale] === undefined) return undefined;
  const { state } = entry;
  const imported = chunks.filter((chunk) => output.imports[chunk]);
  const files = [
    ...new Set([
      ...entry.files,
      ...imported.flatMap((chunk) => output.imports[chunk]),
    ]),
  ];
  const seeded: Record<string, unknown> = {};
  const add = (passed: string) => {
    const translation = translations[output.hashes?.[passed] ?? passed];
    if (translation != null) seeded[passed] = translation;
  };
  entry.messages.forEach(add);
  for (const file of files) output.files[file]?.forEach(add);
  output.unsplit.forEach(add);
  return {
    s: {
      ...getState(state, base),
      h: pick(state.h, locale),
      v: pick(state.v, locale),
      ...(state.e && { e: pick(state.e, locale) }),
      ...(state.o && { o: pick(state.o, locale) }),
    },
    t: seeded as NonNullable<ChunkTranslationsSeed['t']>,
    c: imported,
    k: files,
  };
}

/**
 * What a page that every visitor gets, whatever their locale, is seeded
 * with, as a prerendered shell: where the files of each locale are. Its
 * loader requests the files of the visitor's locale itself. Undefined when
 * the build wrote no files.
 *
 * @param output What the compiler handed the framework's plugin.
 */
export function createChunkTranslationsShellSeed(
  output: SplitTranslationsOutput,
  { chunks, base }: Page
): ChunkTranslationsSeed | undefined {
  const entry = findEntry(output, chunks);
  return entry && { s: getState(entry.state, base) };
}
