import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../../../adapter/core';
import { createI18nDocAndPatchMetadata } from '../createI18nDocAndPatchMetadata';
import {
  createGroqClient,
  metadataDoc,
} from '../../../../utils/__tests__/groqClient';

// A group that records the source document as its de entry too.
const group = metadataDoc('translation.metadata.page', [
  ['en', 'page'],
  ['de', 'page'],
]);
const source = { _id: 'page', _type: 'page', language: 'en', title: 'Hello' };

const importDe = (client: ReturnType<typeof createGroqClient>['client']) =>
  createI18nDocAndPatchMetadata(
    source,
    { _id: 'page', _type: 'page', title: 'Hallo' },
    'de',
    client,
    group,
    'page'
  );

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getSingletons').mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createI18nDocAndPatchMetadata', () => {
  test('never replaces the entry that points at the source', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );
    const { client, create, inserts } = createGroqClient([source, group]);

    await expect(importDe(client)).rejects.toThrow(/Skipped importing/);
    expect(create).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test('without allowNonDefaultSourceLocales, replaces the locale entry as before the option', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
    const { client, create, inserts } = createGroqClient([source, group]);

    await importDe(client);

    expect(create).toHaveBeenCalledTimes(1);
    expect(inserts).toEqual([
      expect.objectContaining({
        documentId: 'translation.metadata.page',
        operation: 'replace',
        location: 'translations[language == "de"]',
      }),
    ]);
  });
});
