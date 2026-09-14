import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GT, LocaleConfig } from '../index';
import { _translateMany } from '../translate/translateMany';
import {
  _createProject,
  type CreateProjectResult,
} from '../projects/createProject';
import { libraryDefaultLocale } from '../settings/settings';
import {
  TranslationResult,
  TranslateManyResult,
  Content,
  JsxChildren,
  TranslateManyEntry,
} from '../types';

// Mock the internal translate function
vi.mock('../translate/translateMany', () => ({
  _translateMany: vi.fn(),
}));
vi.mock('../projects/createProject', () => ({
  _createProject: vi.fn(),
}));

const numberValue = 1234.56;

const brandFrenchMapping = {
  'brand-french': {
    code: 'fr-FR',
    name: 'Brand French',
  },
};

const formatCurrencyWithIntl = (locale: string, currency = 'EUR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
  }).format(numberValue);

describe.sequential('GT Translation Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_translate method', () => {
    let gt: GT;
    const mockTranslationResult: TranslationResult = {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id',
        hash: 'test-key',
      },
      locale: 'es',
      dataFormat: 'ICU',
    };

    beforeEach(() => {
      gt = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });
    });

    it('should call _translateMany with merged configuration', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);

      const source: Content = 'Hello world';

      const result = await gt.translate(source, {
        targetLocale: 'fr',
        context: 'greeting',
      });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        [source],
        expect.objectContaining({
          targetLocale: 'fr',
          sourceLocale: 'en',
          context: 'greeting',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
      expect(result).toEqual(mockTranslationResult);
    });

    it('should throw error when no target locale is provided', async () => {
      const gtNoTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      await expect(
        gtNoTarget.translate('Hello world', { targetLocale: '' })
      ).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified locale. Pass a locale to `translate` or specify targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoProject.translate('Hello world', 'es')).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified project ID. Pass a project ID to `translate` or specify projectId in the GT constructor.'
      );
    });

    it('should use an organization API key with a project ID', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);
      const gtWithOrgKey = new GT({
        orgApiKey: 'gtx-org-test-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      await gtWithOrgKey.translate('Hello world', 'fr');

      expect(mockTranslateMany).toHaveBeenCalledWith(
        ['Hello world'],
        expect.objectContaining({
          targetLocale: 'fr',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'gtx-org-test-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should prefer explicitly configured API keys over environment fallbacks', async () => {
      vi.stubEnv('GT_API_KEY', 'gtx-api-env-key');
      vi.stubEnv('GT_DEV_API_KEY', 'gtx-dev-env-key');

      try {
        const mockTranslateMany = vi.mocked(_translateMany);
        mockTranslateMany.mockResolvedValue([mockTranslationResult]);
        const constructorConfig = new GT({
          orgApiKey: 'gtx-org-explicit-key',
          projectId: 'test-project',
          baseUrl: 'https://api.test.com',
        });
        const setConfig = new GT({
          apiKey: 'gtx-api-project-a-key',
          projectId: 'project-a',
          baseUrl: 'https://api.test.com',
        });
        const allExplicitKeys = new GT({
          apiKey: 'gtx-api-explicit-key',
          devApiKey: 'gtx-dev-explicit-key',
          orgApiKey: 'gtx-org-explicit-key',
          projectId: 'test-project',
          baseUrl: 'https://api.test.com',
        });

        setConfig.setConfig({
          devApiKey: 'gtx-dev-explicit-key',
          projectId: 'project-b',
        });
        setConfig.setConfig({});
        await constructorConfig.translate('Hello world', 'fr');
        await setConfig.translate('Hello world', 'fr');
        setConfig.setConfig({
          orgApiKey: 'gtx-org-explicit-key',
          projectId: 'test-project',
        });
        await setConfig.translate('Hello world', 'fr');
        await allExplicitKeys.translate('Hello world', 'fr');

        expect(
          mockTranslateMany.mock.calls.map(([, , config]) => [
            config.apiKey,
            config.projectId,
          ])
        ).toEqual([
          ['gtx-org-explicit-key', 'test-project'],
          ['gtx-dev-explicit-key', 'project-b'],
          ['gtx-org-explicit-key', 'test-project'],
          ['gtx-api-explicit-key', 'test-project'],
        ]);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('should require a project ID with an organization API key', async () => {
      const gtNoProject = new GT({
        orgApiKey: 'gtx-org-test-key',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoProject.translate('Hello world', 'es')).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified project ID.'
      );
    });

    it('should require an API key with a project ID', async () => {
      const gtNoKey = new GT({
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoKey.translate('Hello world', 'es')).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified API key.'
      );
    });

    it('should handle empty metadata', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);

      const source: Content = 'Hello world';

      await gt.translate(source, 'fr');

      expect(mockTranslateMany).toHaveBeenCalledWith(
        [source],
        expect.objectContaining({
          targetLocale: 'fr',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should handle complex JSX source', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);

      const complexJsxSource: JsxChildren = [
        'Welcome ',
        {
          t: 'strong',
          c: ['John'],
        },
        ' to our ',
        {
          t: 'a',
          c: ['application'],
        },
      ];

      await gt.translate(complexJsxSource, 'es');

      expect(mockTranslateMany).toHaveBeenCalledWith(
        [complexJsxSource],
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should handle dataFormat in metadata', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);

      // Test ICU format
      await gt.translate('Hello {name}', {
        targetLocale: 'es',
        context: 'greeting',
        dataFormat: 'ICU',
      });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        ['Hello {name}'],
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
          context: 'greeting',
          dataFormat: 'ICU',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );

      // Test JSX format
      const jsxSource: JsxChildren = [{ t: 'span', c: ['Hello world'] }];
      await gt.translate(jsxSource, {
        targetLocale: 'fr',
        context: 'greeting',
        dataFormat: 'JSX',
      });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        [jsxSource],
        expect.objectContaining({
          targetLocale: 'fr',
          sourceLocale: 'en',
          context: 'greeting',
          dataFormat: 'JSX',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should handle translation metadata with all fields', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue([mockTranslationResult]);

      await gt.translate('Hello world', {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'dashboard',
        id: 'welcome-msg',
        hash: 'abc123',
        actionType: 'fast' as const,
        dataFormat: 'ICU' as const,
      });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        ['Hello world'],
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
          context: 'dashboard',
          id: 'welcome-msg',
          hash: 'abc123',
          actionType: 'fast',
          dataFormat: 'ICU',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should propagate errors from _translateMany', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      const error = new Error('Translation service unavailable');
      mockTranslateMany.mockRejectedValue(error);

      await expect(gt.translate('Hello world', 'es')).rejects.toThrow(
        'Translation service unavailable'
      );
    });
  });

  describe('translateMany method', () => {
    let gt: GT;
    const mockTranslateManyResult: TranslateManyResult = [
      {
        translation: 'Hola mundo',
        reference: {
          id: 'test-id-1',
          hash: 'test-key-1',
        },
        locale: 'es',
        dataFormat: 'ICU',
      },
      {
        translation: 'Adiós mundo',
        reference: {
          id: 'test-id-2',
          hash: 'test-key-2',
        },
        locale: 'es',
        dataFormat: 'ICU',
      },
    ];

    beforeEach(() => {
      gt = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });
    });

    it('should call _translateMany with correct parameters', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: TranslateManyEntry[] = [
        {
          source: 'Hello world',
          metadata: { context: 'greeting' },
        },
        {
          source: 'Goodbye world',
          metadata: { context: 'farewell' },
        },
      ];

      const result = await gt.translateMany(requests, {
        targetLocale: 'es',
        sourceLocale: 'en',
      });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        requests,
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should use instance targetLocale when not provided in global metadata', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: TranslateManyEntry[] = [
        {
          source: 'Hello world',
          metadata: { context: 'greeting' },
        },
      ];

      const result = await gt.translateMany(requests, 'es');

      expect(mockTranslateMany).toHaveBeenCalledWith(
        requests,
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should throw error when no target locale is provided', async () => {
      const gtNoTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      const requests: TranslateManyEntry[] = [
        {
          source: 'Hello world',
          metadata: { context: 'greeting' },
        },
      ];

      await expect(
        gtNoTarget.translateMany(requests, { targetLocale: '' })
      ).rejects.toThrow(
        'GT Error: Cannot call `translateMany` without a specified locale. Pass a locale to `translateMany` or specify targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      const requests: TranslateManyEntry[] = [
        {
          source: 'Hello world',
          metadata: { context: 'greeting' },
        },
      ];

      await expect(
        gtNoProject.translateMany(requests, { targetLocale: 'es' })
      ).rejects.toThrow(
        'GT Error: Cannot call `translateMany` without a specified project ID. Pass a project ID to `translateMany` or specify projectId in the GT constructor.'
      );
    });

    it('should handle complex JSX sources', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: TranslateManyEntry[] = [
        {
          source: [
            'Welcome ',
            {
              t: 'strong',
              c: ['John'],
            },
          ],
          metadata: { context: 'greeting', dataFormat: 'JSX' },
        },
        {
          source: 'Hello {name}',
          metadata: { context: 'greeting', dataFormat: 'ICU' },
        },
      ];

      await gt.translateMany(requests, { targetLocale: 'es' });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        requests,
        expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        },
        undefined
      );
    });

    it('should propagate errors from _translateMany', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      const error = new Error('Translation service unavailable');
      mockTranslateMany.mockRejectedValue(error);

      const requests: TranslateManyEntry[] = [
        {
          source: 'Hello world',
          metadata: { context: 'greeting' },
        },
      ];

      await expect(
        gt.translateMany(requests, { targetLocale: 'es' })
      ).rejects.toThrow('Translation service unavailable');
    });
  });

  describe('configuration handling', () => {
    it('should handle minimal GT configuration', () => {
      const gt = new GT({
        apiKey: 'test-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.projectId).toBe('test-project');
      expect(gt.baseUrl).toBe('https://api.test.com');
    });

    it('should normalize the development API key alias', () => {
      const gt = new GT({
        devApiKey: 'dev-key',
        orgApiKey: 'gtx-org-test-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });

      expect(gt.apiKey).toBe('dev-key');
      expect(gt.projectId).toBe('test-project');
      expect(gt.baseUrl).toBe('https://api.test.com');
      expect(gt.targetLocale).toBe('es');
    });

    it('should normalize environment keys in priority order and prefer explicit config', () => {
      vi.stubEnv('GT_API_KEY', 'gtx-api-env-key');
      vi.stubEnv('GT_DEV_API_KEY', 'gtx-dev-env-key');
      vi.stubEnv('GT_ORG_API_KEY', 'gtx-org-env-key');

      try {
        expect(new GT().apiKey).toBe('gtx-api-env-key');
        vi.stubEnv('GT_API_KEY', '');
        expect(new GT().apiKey).toBe('gtx-dev-env-key');
        vi.stubEnv('GT_DEV_API_KEY', '');
        expect(new GT().apiKey).toBe('gtx-org-env-key');
        expect(new GT({ orgApiKey: 'gtx-org-explicit-key' }).apiKey).toBe(
          'gtx-org-explicit-key'
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('resolveCanonicalLocale', () => {
    it('should return canonical locale from custom mapping when available', () => {
      const customMapping = {
        'custom-locale': {
          code: 'en-US',
          name: 'Custom English',
        },
      };

      const gt = new GT({
        customMapping,
        targetLocale: 'custom-locale',
      });

      const result = gt.resolveCanonicalLocale('custom-locale');
      expect(result).toBe('en-US');
    });

    it('should return original locale when custom mapping does not have canonical locale', () => {
      const customMapping = {
        'custom-locale': 'Custom English',
      };

      const gt = new GT({
        customMapping,
        targetLocale: 'en-US',
      });

      const result = gt.resolveCanonicalLocale('en-US');
      expect(result).toBe('en-US');
    });

    it('should return original locale when no custom mapping provided', () => {
      const gt = new GT({
        targetLocale: 'fr-FR',
      });

      const result = gt.resolveCanonicalLocale('fr-FR');
      expect(result).toBe('fr-FR');
    });

    it('should use instance target locale when no locale parameter provided', () => {
      const customMapping = {
        'alias-locale': {
          code: 'de-DE',
          name: 'German',
        },
      };

      const gt = new GT({
        customMapping,
        targetLocale: 'alias-locale',
      });

      const result = gt.resolveCanonicalLocale();
      expect(result).toBe('de-DE');
    });

    it('should throw error when no target locale is provided and no parameter', () => {
      const gt = new GT();

      expect(() => gt.resolveCanonicalLocale()).toThrow(
        'GT Error: Cannot call `resolveCanonicalLocale` without a specified locale. Pass a locale to `resolveCanonicalLocale` or specify targetLocale in the GT constructor.'
      );
    });
  });

  describe('resolveAliasLocale', () => {
    it('should return alias locale from reverse custom mapping when available', () => {
      const customMapping = {
        'my-custom-locale': {
          code: 'en-GB',
          name: 'British English',
        },
      };

      const gt = new GT({
        customMapping,
      });

      const result = gt.resolveAliasLocale('en-GB');
      expect(result).toBe('my-custom-locale');
    });

    it('should return original locale when no alias exists in reverse mapping', () => {
      const customMapping = {
        'custom-locale': {
          code: 'fr-FR',
          name: 'French',
        },
      };

      const gt = new GT({
        customMapping,
      });

      const result = gt.resolveAliasLocale('es-ES');
      expect(result).toBe('es-ES');
    });

    it('should return original locale when custom mapping contains string values only', () => {
      const customMapping = {
        'custom-locale': 'Custom Name',
      };

      const gt = new GT({
        customMapping,
      });

      const result = gt.resolveAliasLocale('en-US');
      expect(result).toBe('en-US');
    });

    it('should work with custom mapping parameter instead of instance mapping', () => {
      const gt = new GT();

      const customMapping = {
        'special-locale': {
          code: 'ja-JP',
          name: 'Japanese',
        },
      };

      const result = gt.resolveAliasLocale('ja-JP', customMapping);
      expect(result).toBe('special-locale');
    });

    it('should return original locale when no custom mapping provided', () => {
      const gt = new GT();

      const result = gt.resolveAliasLocale('zh-CN');
      expect(result).toBe('zh-CN');
    });
  });
});

describe.sequential('GT Project Methods', () => {
  const createProjectResult: CreateProjectResult = {
    project: {
      id: 'project-123',
      name: 'Customer Portal',
      orgId: 'org-123',
      defaultLocale: libraryDefaultLocale,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(_createProject).mockResolvedValue(createProjectResult);
  });

  it('should create a project with the library default locale', async () => {
    const gt = new GT({
      orgApiKey: 'gtx-org-test-key',
      baseUrl: 'https://api.test.com',
    });

    const result = await gt.createProject('Customer Portal');

    expect(_createProject).toHaveBeenCalledWith(
      'Customer Portal',
      libraryDefaultLocale,
      {
        baseUrl: 'https://api.test.com',
        apiKey: 'gtx-org-test-key',
      }
    );
    expect(result).toEqual(createProjectResult);
  });

  it('should canonicalize an explicit default locale and use the selected key', async () => {
    const gt = new GT({
      apiKey: 'test-api-key',
      devApiKey: 'gtx-dev-test-key',
      orgApiKey: 'gtx-org-test-key',
      projectId: 'test-project',
      customMapping: {
        'brand-french': {
          code: 'fr-FR',
          name: 'Brand French',
        },
      },
    });

    await gt.createProject('Customer Portal', 'brand-french');

    expect(_createProject).toHaveBeenCalledWith('Customer Portal', 'fr-FR', {
      baseUrl: undefined,
      apiKey: 'test-api-key',
    });
  });

  it('should require an API key', async () => {
    const gt = new GT();

    await expect(gt.createProject('Customer Portal')).rejects.toThrow(
      'GT Error: Cannot call `createProject` without a specified API key.'
    );
    expect(_createProject).not.toHaveBeenCalled();
  });
});

describe('LocaleConfig', () => {
  it('formats with a custom alias by resolving to the canonical locale', () => {
    const localeConfig = new LocaleConfig({
      defaultLocale: 'en-US',
      customMapping: {
        'brand-fr': {
          code: 'fr-FR',
          name: 'Brand French',
        },
      },
    });

    const result = localeConfig.formatCurrency(numberValue, 'EUR', 'brand-fr');

    expect(result).toBe(formatCurrencyWithIntl('fr-FR'));
  });
});

describe('GT LocaleConfig delegation', () => {
  it('formats with a custom target locale alias through LocaleConfig', () => {
    const gt = new GT({
      sourceLocale: 'en-US',
      targetLocale: 'brand-french',
      customMapping: brandFrenchMapping,
    });

    const result = gt.formatCurrency(numberValue, 'EUR');

    expect(result).toBe(formatCurrencyWithIntl('fr-FR'));
  });

  it('exposes core localeConfig and refreshes it from setConfig', () => {
    const gt = new GT({
      apiKey: 'test-api-key',
      devApiKey: 'test-dev-key',
      projectId: 'test-project',
      sourceLocale: 'en-US',
      targetLocale: 'es-ES',
    });
    const initialLocaleConfig = gt.localeConfig;

    expect(gt.localeConfig).toBeInstanceOf(LocaleConfig);
    expect('apiKey' in gt.localeConfig).toBe(false);
    expect('devApiKey' in gt.localeConfig).toBe(false);
    expect('orgApiKey' in gt.localeConfig).toBe(false);
    expect('projectId' in gt.localeConfig).toBe(false);

    gt.setConfig({
      targetLocale: 'brand-french',
      customMapping: brandFrenchMapping,
    });

    expect(gt.localeConfig).not.toBe(initialLocaleConfig);
    expect(gt.resolveCanonicalLocale('brand-french')).toBe('fr-FR');
    expect(gt.formatCurrency(numberValue, 'EUR')).toBe(
      formatCurrencyWithIntl('fr-FR')
    );
  });
});
