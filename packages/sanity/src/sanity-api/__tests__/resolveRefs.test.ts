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
  test('with non-default originals, resolves a reference to any group member', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );
    const { client } = createGroqClient(dataset);

    const resolved = await resolveRefs(translatedPage, 'de', client);

    expect(resolved).toMatchObject({
      author: { _ref: 'author-de' },
      editor: { _ref: 'author-de' },
    });
  });

  test('with the option off, only resolves references to source-locale documents', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
    const { client } = createGroqClient(dataset);

    const resolved = await resolveRefs(translatedPage, 'de', client);

    expect(resolved).toMatchObject({
      author: { _ref: 'author-fr' },
      editor: { _ref: 'author-de' },
    });
  });
});
