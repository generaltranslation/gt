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
