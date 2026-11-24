import {
  PAGE_HASHES_PLACEHOLDER,
  PAGE_ID_PREFIX,
  SERVER_ONLY_HASHES_PLACEHOLDER,
} from './splitTranslationsPlaceholders';

// A minifier does not evaluate a RegExp, but could fold a string method on a
// literal before the build fills it.
const listed = (placeholder: string) =>
  /\[(.+)\]/.exec(placeholder)?.[1].split(';') ?? [];

const serverOnlyHashes = listed(SERVER_ONLY_HASHES_PLACEHOLDER).flatMap(
  (hashes) => hashes.split(',')
);
const pageHashes = new Map(
  listed(PAGE_HASHES_PLACEHOLDER).map((page) => {
    const [id, hashes] = page.split(':');
    return [PAGE_ID_PREFIX + id, hashes.split(',')];
  })
);
const withheldHashes = new Set([
  ...serverOnlyHashes,
  ...Array.from(pageHashes.values()).flat(),
]);

/**
 * The translations without those of the messages only server components
 * render, and without those a page sends with its own client components.
 */
export function getClientTranslations<Translation>(
  translations: Record<string, Translation>
): Record<string, Translation> {
  if (!withheldHashes.size) return translations;
  const clientTranslations = { ...translations };
  withheldHashes.forEach((hash) => delete clientTranslations[hash]);
  return clientTranslations;
}

export function getPageHashes(id: string): string[] | undefined {
  return pageHashes.get(id);
}
