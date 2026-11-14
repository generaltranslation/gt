import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import type { Content } from '@generaltranslation/format';
import { vi } from 'vitest';
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

/** A runtime translation request entry, as gt-i18n sends it. */
export type RuntimeTranslationRequest = {
  source: Content;
  metadata: { hash: string; context?: string; dataFormat: string };
};

/**
 * Initializes GT with credentials and answers runtime translation requests
 * with `translate`. Returns the requested entries.
 */
export function setupRuntimeTranslation(
  translate: (source: Content) => Content
): RuntimeTranslationRequest[] {
  const requests: RuntimeTranslationRequest[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo, init?: RequestInit) => {
    const body = (await new Request(input, init).json()) as {
      targetLocale: string;
      requests: RuntimeTranslationRequest[];
    };
    requests.push(...body.requests);
    return Response.json({
      results: body.requests.map((request) => ({
        status: 'succeeded',
        translation: translate(request.source),
        dataFormat: request.metadata.dataFormat,
        locale: body.targetLocale,
      })),
    });
  });
  delete (globalThis as { __generaltranslation?: unknown })
    .__generaltranslation;
  initializeGT({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    projectId: 'project-id',
    apiKey: 'api-key',
    loadTranslations: async () => ({}),
  });
  return requests;
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
