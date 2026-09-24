import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GT, LocaleConfig } from '../index';
import type { TranslateManyEntry } from '../types';

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
  describe.each(['translate', 'translateMany'] as const)('%s', (method) => {
    const fetchMock = vi.fn<typeof fetch>();
    let gt: GT;

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      vi.stubEnv('GT_PROJECT_ID', '');
      gt = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        sourceLocale: 'en',
        targetLocale: 'es',
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it('sends instance configuration and explicit translation metadata', async () => {
      const translated = {
        success: true,
        translation: 'Bonjour',
        locale: 'fr',
        dataFormat: 'ICU',
      } as const;
      fetchMock.mockResolvedValue(Response.json({ greeting: translated }));
      const entry = {
        source: 'Hello {name}',
        metadata: { hash: 'greeting', id: 'welcome', dataFormat: 'ICU' },
      } satisfies TranslateManyEntry;
      const options = {
        targetLocale: 'fr',
        sourceLocale: 'en-US',
        context: 'dashboard',
        actionType: 'standard',
      };
      const result =
        method === 'translate'
          ? await gt.translate(entry, options)
          : await gt.translateMany([entry], options);

      expect(result).toEqual(
        method === 'translate' ? translated : [translated]
      );
      const [input, init] = fetchMock.mock.calls[0];
      const request = new Request(input, init);
      expect(request.url).toBe('https://api.test.com/v2/translate');
      expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
      expect(request.headers.get('gt-project-id')).toBe('test-project');
      expect(await request.json()).toMatchObject({
        requests: { greeting: entry },
        targetLocale: 'fr',
        sourceLocale: 'en-US',
        metadata: options,
      });
    });

    it('names the method when the target locale is missing', async () => {
      const withoutTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
      const result =
        method === 'translate'
          ? withoutTarget.translate('Hello', '')
          : withoutTarget.translateMany(['Hello'], '');

      await expect(result).rejects.toThrow(
        `GT Error: Cannot call \`${method}\` without a specified locale. Pass a locale to \`${method}\` or specify targetLocale in the GT constructor.`
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('names the method when the project ID is missing', async () => {
      const withoutProject = new GT({ apiKey: 'test-api-key' });
      const result =
        method === 'translate'
          ? withoutProject.translate('Hello', 'es')
          : withoutProject.translateMany(['Hello'], 'es');

      await expect(result).rejects.toThrow(
        `GT Error: Cannot call \`${method}\` without a specified project ID. Pass a project ID to \`${method}\` or specify projectId in the GT constructor.`
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('propagates network failures', async () => {
      const error = new Error('Translation service unavailable');
      fetchMock.mockRejectedValue(error);
      const result =
        method === 'translate'
          ? gt.translate('Hello', 'es')
          : gt.translateMany(['Hello'], 'es');

      await expect(result).rejects.toBe(error);
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

    it('should handle GT configuration with all options', () => {
      const gt = new GT({
        apiKey: 'test-key',
        devApiKey: 'dev-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.devApiKey).toBe('dev-key');
      expect(gt.projectId).toBe('test-project');
      expect(gt.baseUrl).toBe('https://api.test.com');
      expect(gt.targetLocale).toBe('es');
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
  it.each(['sourceLocale', 'targetLocale', 'locales'] as const)(
    'validates a partial %s update with the retained custom mapping',
    (field) => {
      const gt = new GT({ customMapping: brandFrenchMapping });
      const value = field === 'locales' ? ['brand-french'] : 'brand-french';

      expect(() => gt.setConfig({ [field]: value })).not.toThrow();
      expect(gt[field]).toEqual(value);
      expect(gt.resolveCanonicalLocale('brand-french')).toBe('fr-FR');
      expect(
        gt.localeConfig.formatCurrency(numberValue, 'EUR', 'brand-french')
      ).toBe(formatCurrencyWithIntl('fr-FR'));
    }
  );

  it('uses a replacement mapping when validating and resolving a locale update', () => {
    const gt = new GT({ customMapping: brandFrenchMapping });
    gt.setConfig({
      targetLocale: 'brand-german',
      customMapping: { 'brand-german': { code: 'de-DE' } },
    });

    expect(gt.resolveCanonicalLocale('brand-german')).toBe('de-DE');
    expect(gt.isValidLocale('brand-french')).toBe(false);
  });

  it('does not validate against the retained mapping when it is explicitly cleared', () => {
    const gt = new GT({ customMapping: brandFrenchMapping });

    expect(() =>
      gt.setConfig({ targetLocale: 'brand-french', customMapping: {} })
    ).toThrow();
  });

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
