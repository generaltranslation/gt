import type { MessageTree } from '@generaltranslation/icu';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';

/**
 * Converts a translation stored as an ICU string to a message tree, using
 * the source tree for its formats; throws for invalid ICU or changed
 * variables. `hash` is the message's catalog key, for caching.
 */
export type TranslationParser = (
  icu: string,
  source: MessageTree,
  hash: string
) => MessageTree;

// A global like the other singletons, so one import registers the parser for
// every copy of gt-i18n an app loads, ESM and CommonJS alike.
const translationParserSingleton = createGlobalSingleton<TranslationParser>({
  namespace: 'i18n',
  key: 'translationParser',
  source: 'gt-i18n',
  notInitialized: () => 'The ICU translation parser is not registered',
});

/** Registered by the gt-i18n/unstable/icu entry. */
export function setTranslationParser(parser: TranslationParser): void {
  translationParserSingleton.set(parser);
}

export function getTranslationParser(): TranslationParser | undefined {
  return translationParserSingleton.isInitialized()
    ? translationParserSingleton.get()
    : undefined;
}
