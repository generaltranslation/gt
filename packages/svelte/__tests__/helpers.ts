import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import type { Content } from '@generaltranslation/format/types';
import { initializeGT } from '../src/runtime/config';

/** Hashes of every `<T>` in a fixture, in source order. */
export function hashesOf(fixture: string): string[] {
  // Vitest runs from the package root; jsdom has no file-based import.meta.url.
  const path = join(process.cwd(), '__tests__/fixtures', fixture);
  const { translations, errors } = analyzeSvelteSource(
    readFileSync(path, 'utf8'),
    { parse }
  );
  if (errors.length > 0) throw new Error(JSON.stringify(errors));
  return translations.map((translation) => translation.hash);
}

/** Source and hash of every string call in a fixture, in source order. */
export function stringsOf(fixture: string): { source: string; hash: string }[] {
  const path = join(process.cwd(), '__tests__/fixtures', fixture);
  const { strings, errors } = analyzeSvelteSource(readFileSync(path, 'utf8'), {
    parse,
  });
  if (errors.length > 0) throw new Error(JSON.stringify(errors));
  return strings.map(({ source, hash }) => ({ source, hash }));
}

/** Initializes GT with an in-memory translation catalog. */
export function setupGT(
  catalog: Record<string, Record<string, Content>> = {},
  loadTranslations: (
    locale: string
  ) => Promise<Record<string, Content>> = async (locale) =>
    catalog[locale] ?? {}
) {
  // gt-i18n singletons keep their first value, so start each test fresh.
  delete (globalThis as { __generaltranslation?: unknown })
    .__generaltranslation;
  initializeGT({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'de', 'ar', 'he', 'fa'],
    loadTranslations,
  });
}

/** Removes Svelte's hydration comments from rendered HTML. */
export function withoutComments(html: string): string {
  // Repeat until nothing changes so a removal cannot leave a comment behind.
  let previous: string;
  do {
    previous = html;
    html = html.replace(/<!--[^>]*-->/g, '');
  } while (html !== previous);
  return html;
}
