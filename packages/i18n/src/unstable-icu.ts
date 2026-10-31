/**
 * Lets /unstable translations be ICU strings as well as message trees:
 *
 *   import 'gt-i18n/unstable/icu';
 *   // a catalog entry may now be
 *   // 'Vous avez {count, plural, one {# fichier} other {# fichiers}}'
 *
 * Import it once wherever messages render (on the server and the client).
 * Each string is converted on first use with its message's source tree,
 * which restores Intl options ICU cannot spell; a string that is not valid
 * ICU or changes the variables renders the source with a warning. Apps that
 * store trees skip this entry and never load the ICU parser.
 */
import type { MessageTree } from '@generaltranslation/icu';
import { icuToMessageTree } from '@generaltranslation/icu/convert';
import { setTranslationParser } from './unstable/translationParser';

// A message's string and hash always convert the same way, failures included.
const converted = new Map<string, MessageTree | Error>();
// Entries are per message and string; the cap bounds memory when catalogs reload.
const MAX_CONVERTED = 10_000;

setTranslationParser((icu, source, hash) => {
  const key = `${hash}\n${icu}`;
  let result = converted.get(key);
  if (result === undefined) {
    try {
      result = icuToMessageTree(icu, { source });
    } catch (error) {
      result = error instanceof Error ? error : new Error(String(error));
    }
    if (converted.size >= MAX_CONVERTED) converted.clear();
    converted.set(key, result);
  }
  if (result instanceof Error) throw result;
  return result;
});
