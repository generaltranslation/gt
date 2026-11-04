import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import {
  checkTranslatableOriginal,
  getInitialDocumentRoleState,
  resolveDocumentRoleState,
  UNVERIFIED_ROLE_MESSAGE,
} from '../documentRoleState';
import { HAS_MARKED_GROUPS_QUERY } from '../../translation/bulkSources';
import { createGroqClient, metadataDoc } from './groqClient';

const failingClient = {
  fetch: vi.fn(async () => {
    throw new Error('network down');
  }),
} as unknown as SanityClient;

/**
 * A client whose translation group lookups fail while every other query —
 * including whether the dataset has marked groups — runs against `dataset`.
 */
function clientFailingGroupLookup(
  dataset: Parameters<typeof createGroqClient>[0]
) {
  const { client } = createGroqClient(dataset);
  const fetch = client.fetch.bind(client);
  return {
    fetch: vi.fn(async (query: string, params?: Record<string, unknown>) => {
      if (query === HAS_MARKED_GROUPS_QUERY) return fetch(query, params);
      throw new Error('network down');
    }),
  } as unknown as SanityClient;
}

const markedGroup = metadataDoc(
  'm-other',
  [
    ['fr', 'other-fr'],
    ['en', 'other-en'],
  ],
  { gtSourceLanguage: 'fr' }
);

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getInitialDocumentRoleState', () => {
  test('shows a source-locale document as an original right away', () => {
    expect(getInitialDocumentRoleState('en')).toEqual({
      status: 'resolved',
      role: { kind: 'original', language: 'en' },
    });
  });

  test('waits for the lookup on a document in another locale', () => {
    expect(getInitialDocumentRoleState('fr')).toEqual({ status: 'resolving' });
  });
});

describe('resolveDocumentRoleState', () => {
  test('resolves the role from the group', async () => {
    const group = metadataDoc('m', [
      ['en', 'page'],
      ['fr', 'page-fr'],
    ]);
    const { client } = createGroqClient([{ _id: 'page', _type: 'page' }]);

    expect(
      await resolveDocumentRoleState({
        documentId: 'page-fr',
        language: 'fr',
        snapshot: { metadata: group },
        client,
      })
    ).toEqual({
      status: 'resolved',
      role: { kind: 'translation', language: 'fr', originalLanguage: 'en' },
    });
  });

  test('a failed lookup leaves a source-locale document translatable without marked groups', async () => {
    const { client } = createGroqClient([
      metadataDoc('m', [
        ['en', 'other'],
        ['fr', 'other-fr'],
      ]),
    ]);

    expect(
      await resolveDocumentRoleState({
        documentId: 'page',
        language: 'en',
        snapshot: { error: new Error('listener failed') },
        client,
      })
    ).toEqual({
      status: 'resolved',
      role: { kind: 'original', language: 'en' },
    });
  });

  test('a failed lookup leaves a source-locale document unverified once marked groups exist', async () => {
    const { client } = createGroqClient([markedGroup]);

    expect(
      await resolveDocumentRoleState({
        documentId: 'page',
        language: 'en',
        snapshot: { error: new Error('listener failed') },
        client,
      })
    ).toEqual({ status: 'unverified' });
  });

  test('a source-locale document is unverified when marked groups cannot be checked either', async () => {
    expect(
      await resolveDocumentRoleState({
        documentId: 'page',
        language: 'en',
        snapshot: { error: new Error('listener failed') },
        client: failingClient,
      })
    ).toEqual({ status: 'unverified' });
  });

  test('a failed lookup leaves another locale unverified, not a translation', async () => {
    // Checking that the original still exists fails.
    const group = metadataDoc('m', [
      ['en', 'page'],
      ['fr', 'page-fr'],
    ]);

    expect(
      await resolveDocumentRoleState({
        documentId: 'page-fr',
        language: 'fr',
        snapshot: { metadata: group },
        client: failingClient,
      })
    ).toEqual({ status: 'unverified' });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('gt-sanity Error:')
    );
  });
});

describe('checkTranslatableOriginal', () => {
  test('allows the original of a group', async () => {
    const { client } = createGroqClient([
      metadataDoc('m', [['fr', 'page-fr']], { gtSourceLanguage: 'fr' }),
    ]);

    expect(
      await checkTranslatableOriginal(
        { _id: 'drafts.page-fr', _type: 'page', language: 'fr' },
        client
      )
    ).toEqual({ translatable: true });
  });

  test('refuses a source-locale translation of another original', async () => {
    const { client } = createGroqClient([
      { _id: 'page-fr', _type: 'page', language: 'fr' },
      metadataDoc(
        'm',
        [
          ['fr', 'page-fr'],
          ['en', 'page-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ]);

    expect(
      await checkTranslatableOriginal(
        { _id: 'page-en', _type: 'page', language: 'en' },
        client
      )
    ).toEqual({
      translatable: false,
      message:
        'This document is a translation of fr. Translate from the fr original instead.',
    });
  });

  test('keeps translating a source-locale document when the lookup fails without marked groups', async () => {
    expect(
      await checkTranslatableOriginal(
        { _id: 'page', _type: 'page', language: 'en' },
        clientFailingGroupLookup([])
      )
    ).toEqual({ translatable: true });
  });

  test('refuses a source-locale document when the lookup fails and marked groups exist', async () => {
    expect(
      await checkTranslatableOriginal(
        { _id: 'page', _type: 'page', language: 'en' },
        clientFailingGroupLookup([markedGroup])
      )
    ).toEqual({ translatable: false, message: UNVERIFIED_ROLE_MESSAGE });
  });

  test('refuses a source-locale document when marked groups cannot be checked either', async () => {
    expect(
      await checkTranslatableOriginal(
        { _id: 'page', _type: 'page', language: 'en' },
        failingClient
      )
    ).toEqual({ translatable: false, message: UNVERIFIED_ROLE_MESSAGE });
  });

  test('refuses a document in another locale when the lookup fails', async () => {
    expect(
      await checkTranslatableOriginal(
        { _id: 'page-fr', _type: 'page', language: 'fr' },
        failingClient
      )
    ).toEqual({ translatable: false, message: UNVERIFIED_ROLE_MESSAGE });
  });
});
