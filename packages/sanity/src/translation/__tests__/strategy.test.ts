import { afterEach, describe, expect, test } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import {
  getTranslationStrategy,
  getTranslationStrategyForType,
} from '../strategy';
import type { SanityDocument } from 'sanity';

const doc = (type: string) =>
  ({ _id: 'a', _type: type, _rev: 'r' }) as unknown as SanityDocument;

afterEach(() => {
  pluginConfig.translationLevel = 'document';
  pluginConfig.fieldLevelDocuments = [];
});

describe('getTranslationStrategy', () => {
  test("'document' mode always uses the document-level strategy", () => {
    pluginConfig.translationLevel = 'document';
    expect(getTranslationStrategyForType('post').level).toBe('document');
  });

  test("'internationalizedArray' mode always uses the array strategy", () => {
    pluginConfig.translationLevel = 'internationalizedArray';
    expect(getTranslationStrategy(doc('post')).level).toBe(
      'internationalizedArray'
    );
    expect(getTranslationStrategy(doc('page')).level).toBe(
      'internationalizedArray'
    );
  });

  test("'mixed' mode routes by document type", () => {
    pluginConfig.translationLevel = 'mixed';
    pluginConfig.fieldLevelDocuments = [{ type: 'post' }];
    expect(getTranslationStrategyForType('post').level).toBe(
      'internationalizedArray'
    );
    expect(getTranslationStrategyForType('page').level).toBe('document');
  });

  test('an unknown/undefined type falls back to document-level', () => {
    pluginConfig.translationLevel = 'mixed';
    pluginConfig.fieldLevelDocuments = [{ type: 'post' }];
    expect(getTranslationStrategyForType(undefined).level).toBe('document');
  });
});
