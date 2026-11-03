import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityDocument } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import { resolveRefs } from '../resolveRefs';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

const dataset = [
  // Unmarked group: en original with a fr translation.
  metadataDoc('m-author', [
    ['en', 'author'],
    ['fr', 'author-fr'],
    ['de', 'author-de'],
  ]),
  // Marked group: fr original with en and de translations.
  metadataDoc(
    'm-marie',
    [
      ['fr', 'author-marie'],
      ['en', 'author-marie-en'],
      ['de', 'author-marie-de'],
    ],
    { gtSourceLanguage: 'fr' }
  ),
];

// A page translated into de from a fr original carries the fr references.
const translatedPage = {
  _id: 'drafts.page-de',
  _type: 'page',
  author: { _type: 'reference', _ref: 'author-fr' },
  editor: { _type: 'reference', _ref: 'author' },
} as unknown as SanityDocument;

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  // Feature tests run with the option on; flag-off tests turn it off.
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRefs', () => {
  test('for a non-default original, resolves a reference to any group member', async () => {
    const { client } = createGroqClient(dataset);

    const resolved = await resolveRefs(translatedPage, 'de', client, 'fr');

    expect(resolved).toMatchObject({
      author: { _ref: 'author-de' },
      editor: { _ref: 'author-de' },
    });
  });

  test('for a source-locale original, only resolves references to source-locale documents', async () => {
    const { client } = createGroqClient(dataset);

    const resolved = await resolveRefs(translatedPage, 'de', client);

    expect(resolved).toMatchObject({
      author: { _ref: 'author-fr' },
      editor: { _ref: 'author-de' },
    });
    expect(await resolveRefs(translatedPage, 'de', client, 'en')).toEqual(
      resolved
    );
  });

  test('for a source-locale original, resolves a reference to a marked group original', async () => {
    const { client } = createGroqClient(dataset);
    const page = {
      _id: 'drafts.article-1-de',
      _type: 'page',
      author: { _type: 'reference', _ref: 'author-marie' },
      reviewer: { _type: 'reference', _ref: 'author-marie-en' },
    } as unknown as SanityDocument;

    expect(await resolveRefs(page, 'de', client)).toMatchObject({
      author: { _ref: 'author-marie-de' },
      reviewer: { _ref: 'author-marie-de' },
    });
  });
});

describe('resolveRefs without allowNonDefaultSourceLocales', () => {
  // The query resolveRefs ran before the option existed.
  const SOURCE_LOCALE_QUERY = `*[_type == "translation.metadata" && count(translations[language == $sourceLocale && value._ref in $refIds]) > 0] {
    "originalRef": translations[language == $sourceLocale][0].value._ref,
    "translatedRefs": translations[language == $locale].value._ref
  }[defined(originalRef) && count(translatedRefs) > 0]`;

  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
  });

  test('only resolves references to source-locale documents, with the original query', async () => {
    const { client, fetch } = createGroqClient(dataset);
    const page = {
      _id: 'drafts.article-1-de',
      _type: 'page',
      author: { _type: 'reference', _ref: 'author-marie' },
      reviewer: { _type: 'reference', _ref: 'author-marie-en' },
      editor: { _type: 'reference', _ref: 'author' },
    } as unknown as SanityDocument;

    const resolved = await resolveRefs(page, 'de', client);

    // A marked group's original is not resolved, but its en translation is
    // the group's en entry and is, as before the option existed.
    expect(resolved).toMatchObject({
      author: { _ref: 'author-marie' },
      reviewer: { _ref: 'author-marie-de' },
      editor: { _ref: 'author-de' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(SOURCE_LOCALE_QUERY, {
      refIds: ['author-marie', 'author-marie-en', 'author'],
      sourceLocale: 'en',
      locale: 'de',
    });
  });

  test('ignores a non-default source language', async () => {
    const { client, fetch } = createGroqClient(dataset);

    const resolved = await resolveRefs(translatedPage, 'de', client, 'fr');

    expect(resolved).toMatchObject({
      author: { _ref: 'author-fr' },
      editor: { _ref: 'author-de' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(SOURCE_LOCALE_QUERY);
  });
});
