import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import { findTranslatedDocumentForLocale } from '../findDocuments';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

// The query findTranslatedDocumentForLocale ran before the option existed.
const SOURCE_LOCALE_QUERY = `*[
    _type == "translation.metadata" &&
    (
      translations[language == $sourceLocale][0].value._ref == $cleanDocId
    ) &&
    defined(translations[language == $localeId])
  ][0].translations[language == $localeId].value._ref`;

const dataset = [
  { _id: 'page-fr', _type: 'page', language: 'fr' },
  { _id: 'page-de', _type: 'page', language: 'de' },
  // Marked group: fr original with a de translation.
  metadataDoc(
    'm',
    [
      ['fr', 'page-fr'],
      ['de', 'page-de'],
    ],
    { gtSourceLanguage: 'fr' }
  ),
];

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('findTranslatedDocumentForLocale', () => {
  test('finds a translation of a non-default original through its marker', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );
    const { client } = createGroqClient(dataset);

    expect(
      await findTranslatedDocumentForLocale('page-fr', 'de', client, 'fr')
    ).toMatchObject({ _id: 'page-de' });
  });

  test('without allowNonDefaultSourceLocales, runs the original source-locale query', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
    const { client, fetch } = createGroqClient(dataset);

    expect(
      await findTranslatedDocumentForLocale('page-fr', 'de', client, 'fr')
    ).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(SOURCE_LOCALE_QUERY, {
      sourceLocale: 'en',
      cleanDocId: 'page-fr',
      localeId: 'de',
    });
  });
});
