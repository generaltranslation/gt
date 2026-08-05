import { afterEach, describe, expect, it, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import type { TranslationPreferences } from '../../adapter/types';
import type { Secrets } from '../../types';
import { buildDebugInfo, formatDebugInfo } from '../debugInfo';

const API_KEY = 'gtx-super-secret-api-key';

const secrets: Secrets = {
  organization: 'org',
  project: 'gt-project-id',
  secret: API_KEY,
};

const preferences: TranslationPreferences = {
  autoRefresh: true,
  autoImport: true,
  autoPatchReferences: false,
  autoPublish: false,
  preserveExistingTranslations: false,
};

describe('buildDebugInfo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never includes the API key', () => {
    const serialized = formatDebugInfo(
      buildDebugInfo({
        secrets,
        preferences,
        sanityProjectId: 'sanity-project',
        sanityDataset: 'production',
        branchId: 'branch-1',
      })
    );

    expect(serialized).not.toContain(API_KEY);
    // `secretsNamespace` legitimately contains the word, so assert on values
    // rather than the text: nothing anywhere in the result is the key.
    const values = JSON.stringify(Object.values(JSON.parse(serialized)));
    expect(values).not.toContain(API_KEY);
  });

  it('reports whether an API key is set without revealing it', () => {
    expect(
      buildDebugInfo({ secrets, preferences }).generalTranslation
        .apiKeyConfigured
    ).toBe(true);
    expect(
      buildDebugInfo({
        secrets: { ...secrets, secret: undefined },
        preferences,
      }).generalTranslation.apiKeyConfigured
    ).toBe(false);
  });

  it('distinguishes a missing secrets document from one without a key', () => {
    expect(
      buildDebugInfo({ secrets: null, preferences }).generalTranslation
        .secretsDocumentFound
    ).toBe(false);
    expect(
      buildDebugInfo({ secrets, preferences }).generalTranslation
        .secretsDocumentFound
    ).toBe(true);
  });

  it('reports the resolved plugin configuration', () => {
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en-US');
    vi.spyOn(pluginConfig, 'getLocales').mockReturnValue(['ja-JP', 'ko-KR']);
    vi.spyOn(pluginConfig, 'getTranslationLevel').mockReturnValue('mixed');
    vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([
      { type: 'landingPage' },
    ]);

    const info = buildDebugInfo({ secrets, preferences });

    expect(info.locales).toEqual({
      sourceLocale: 'en-US',
      targetLocales: ['ja-JP', 'ko-KR'],
    });
    expect(info.documents.translationLevel).toBe('mixed');
    expect(info.documents.translateDocuments).toEqual([
      { type: 'landingPage' },
    ]);
    expect(info.package.name).toBe('gt-sanity');
    expect(info.package.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reduces serializers to names and counts', () => {
    vi.spyOn(pluginConfig, 'getAdditionalSerializers').mockReturnValue({
      types: { myBlock: () => '' },
    });
    vi.spyOn(pluginConfig, 'getAdditionalBlockDeserializers').mockReturnValue([
      {},
      {},
    ]);

    const info = buildDebugInfo({ secrets, preferences });

    expect(info.customization.additionalSerializers).toEqual(['myBlock']);
    expect(info.customization.additionalBlockDeserializers).toBe(2);
    // The config holds functions; the result has to survive JSON.
    expect(() => formatDebugInfo(info)).not.toThrow();
    expect(formatDebugInfo(info)).not.toContain('function');
  });
});
