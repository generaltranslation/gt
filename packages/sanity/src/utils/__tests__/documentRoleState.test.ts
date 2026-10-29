import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import {
  checkTranslatableOriginal,
  getInitialDocumentRoleState,
  resolveDocumentRoleState,
  UNVERIFIED_ROLE_MESSAGE,
} from '../documentRoleState';
import { createGroqClient, metadataDoc } from './groqClient';

const failingClient = {
  fetch: vi.fn(async () => {
    throw new Error('network down');
  }),
} as unknown as SanityClient;

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

  test('a failed lookup leaves a source-locale document translatable', async () => {
    const { client } = createGroqClient([]);

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

  test('keeps translating a source-locale document when the lookup fails', async () => {
    expect(
      await checkTranslatableOriginal(
        { _id: 'page', _type: 'page', language: 'en' },
        failingClient
      )
    ).toEqual({ translatable: true });
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
