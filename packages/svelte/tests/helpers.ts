import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import type { Translation } from 'gt-i18n/types';
import { initializeGT } from '../src/runtime/config';

/** Hashes of every `<T>` in a fixture, in source order. */
export function hashesOf(fixture: string): string[] {
  // Vitest runs from the package root; jsdom has no file-based import.meta.url.
  const path = join(process.cwd(), 'tests/fixtures', fixture);
  const { translations, errors } = analyzeSvelteSource(
    readFileSync(path, 'utf8'),
    { parse }
  );
  if (errors.length > 0) throw new Error(JSON.stringify(errors));
  return translations.map((translation) => translation.hash);
}

/** Initializes GT with an in-memory translation catalog. */
export function setupGT(
  catalog: Record<string, Record<string, Translation>> = {},
  loadTranslations: (
    locale: string
  ) => Promise<Record<string, Translation>> = async (locale) =>
    catalog[locale] ?? {}
) {
  // gt-i18n singletons keep their first value, so start each test fresh.
  delete (globalThis as { __generaltranslation?: unknown })
    .__generaltranslation;
  initializeGT({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    loadTranslations,
  });
}
