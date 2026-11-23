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
  /**
   * The hashes of the messages that the server's own code can send a page as
   * data, which the compiler tells the framework's plugin of
   * (`onServerMessages`). The browser reads them by their hash, so their
   * translations go with every page.
   */
  serverMessages: readonly string[];
};

const pickMessages = (
  hashes: readonly string[],
  translations: Record<string, unknown>
): Record<string, unknown> =>
  Object.fromEntries(
    hashes.flatMap((hash) =>
      translations[hash] == null ? [] : [[hash, translations[hash]]]
    )
  );

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
 * the entry, of the imports of `chunks`, of the unsplit messages and of the
 * server's own messages, read from the locale's catalog and keyed as the
 * browser reads them.
 *
 * The build may have no files for the locale while the catalog has
 * translations, as when a server loads catalogs the build did not read.
 * Nothing the page requests later could add to what it holds then, so it is
 * seeded with the translations of every chunk. Undefined when there is
 * nothing to seed, as in the default locale.
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
    serverMessages,
  }: Page & { locale: string; translations: Record<string, unknown> }
): ChunkTranslationsSeed | undefined {
  const entry = findEntry(output, chunks);
  if (!entry) return undefined;
  const { state } = entry;
  const hasFiles = state.h[locale] !== undefined;
  const imported = hasFiles
    ? chunks.filter((chunk) => output.imports[chunk])
    : Object.keys(output.imports);
  const files = [
    ...new Set([
      ...entry.files,
      ...imported.flatMap((chunk) => output.imports[chunk]),
    ]),
  ];
  const seeded = pickMessages(serverMessages, translations);
  const add = (passed: string) => {
    const translation = translations[output.hashes?.[passed] ?? passed];
    if (translation != null) seeded[passed] = translation;
  };
  entry.messages.forEach(add);
  for (const file of files) output.files[file]?.forEach(add);
  output.unsplit.forEach(add);
  if (!hasFiles && Object.keys(seeded).length === 0) return undefined;
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
 * loader requests the files of the visitor's locale itself. No file of the
 * build holds the server's own messages for sure, so the seed holds their
 * translations in every locale. Undefined when the build wrote no files.
 *
 * @param output What the compiler handed the framework's plugin.
 * @param page.catalogs The catalog of each locale the build has files for, by locale. Read only when the server has messages of its own.
 */
export function createChunkTranslationsShellSeed(
  output: SplitTranslationsOutput,
  {
    chunks,
    base,
    serverMessages,
    catalogs,
  }: Page & { catalogs: Record<string, Record<string, unknown> | undefined> }
): ChunkTranslationsSeed | undefined {
  const entry = findEntry(output, chunks);
  if (!entry) return undefined;
  const messages = Object.fromEntries(
    Object.keys(entry.state.h).map((locale) => [
      locale,
      pickMessages(serverMessages, catalogs[locale] ?? {}),
    ])
  );
  return {
    s: getState(entry.state, base),
    ...(serverMessages.length > 0 && {
      m: messages as NonNullable<ChunkTranslationsSeed['m']>,
    }),
  };
}
