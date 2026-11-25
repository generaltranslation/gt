import { SERVER_ONLY_HASHES_PLACEHOLDER } from './serverOnlyHashesPlaceholder';

// A minifier does not evaluate a RegExp, but could fold a string method on the
// literal before the build fills it.
const serverOnlyHashes = new Set(
  /\[(.+)\]/.exec(SERVER_ONLY_HASHES_PLACEHOLDER)?.[1].split(',')
);

/**
 * The translations without those of the messages only server components
 * render.
 */
export function getClientTranslations<Translation>(
  translations: Record<string, Translation>
): Record<string, Translation> {
  if (!serverOnlyHashes.size) return translations;
  const clientTranslations = { ...translations };
  serverOnlyHashes.forEach((hash) => delete clientTranslations[hash]);
  return clientTranslations;
}
