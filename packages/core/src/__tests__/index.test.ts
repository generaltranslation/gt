import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GT, LocaleConfig } from '../index';
import { GTRuntime } from '../runtime';
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

describe('GT translation methods', () => {
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

  it('exposes the configured credentials, base URL and target locale', () => {
    const gt = new GT({
      apiKey: 'test-key',
      devApiKey: 'dev-key',
      projectId: 'test-project',
      baseUrl: 'https://api.test.com',
      targetLocale: 'es',
    });

    expect(gt).toMatchObject({
      apiKey: 'test-key',
      devApiKey: 'dev-key',
      projectId: 'test-project',
      baseUrl: 'https://api.test.com',
      targetLocale: 'es',
    });
  });
});

describe('GT locale resolution', () => {
  const customMapping = {
    'custom-locale': { code: 'en-US', name: 'Custom English' },
    'name-only': 'Name Only',
  };

  it.each([
    ['an alias with a canonical code', 'custom-locale', 'en-US'],
    ['an alias without a canonical code', 'name-only', 'name-only'],
    ['a locale outside the mapping', 'fr-FR', 'fr-FR'],
    ['the instance target locale', undefined, 'en-US'],
  ])('resolves %s to its canonical locale', (_name, locale, expected) => {
    const gt = new GT({ customMapping, targetLocale: 'custom-locale' });

    expect(gt.resolveCanonicalLocale(locale)).toBe(expected);
  });

  it('resolves canonical locales without a custom mapping', () => {
    expect(new GT().resolveCanonicalLocale('fr-FR')).toBe('fr-FR');
  });

  it('requires a locale to resolve when no target locale is configured', () => {
    expect(() => new GT().resolveCanonicalLocale()).toThrow(
      'GT Error: Cannot call `resolveCanonicalLocale` without a specified locale. Pass a locale to `resolveCanonicalLocale` or specify targetLocale in the GT constructor.'
    );
  });

  it.each([
    ['a canonical code with an alias', 'en-US', 'custom-locale'],
    ['a canonical code without an alias', 'es-ES', 'es-ES'],
  ])('resolves %s to its alias locale', (_name, locale, expected) => {
    expect(new GT({ customMapping }).resolveAliasLocale(locale)).toBe(expected);
  });

  it('resolves alias locales from a per-call mapping or none at all', () => {
    const gt = new GT();

    expect(gt.resolveAliasLocale('en-US', customMapping)).toBe('custom-locale');
    expect(gt.resolveAliasLocale('zh-CN')).toBe('zh-CN');
    expect(gt.resolveAliasLocale('en-US', { 'name-only': 'Name Only' })).toBe(
      'en-US'
    );
  });
});

describe('GTRuntime.determineLocale approved identifiers', () => {
  it.each([
    ['sh', 'sr-Latn'],
    ['cnr', 'sr-ME'],
  ])('preserves accepted legacy code %s', (locale, canonical) => {
    const gt = new GTRuntime({ sourceLocale: locale, locales: [locale] });
    expect(gt.sourceLocale).toBe(locale);
    expect(gt.determineLocale(locale)).toBe(locale);
    expect(gt.determineLocale(canonical)).toBe(locale);
  });

  it('preserves explicit approved spelling with configured and per-call mappings', () => {
    const gt = new GTRuntime({ locales: ['en-us', 'fr'] });
    // Constructor locales and explicit approved lists retain configured spelling.
    expect(gt.determineLocale('en-US')).toBe('en-us');
    expect(gt.determineLocale('en-US', ['en-us'])).toBe('en-us');
    expect(gt.determineLocale('en-US', ['en-us'], {})).toBe('en-us');
  });

  it('resolves per-call aliases back to the approved identifier', () => {
    const gt = new GTRuntime();
    expect(
      gt.determineLocale('en-GB', ['brand'], { brand: { code: 'en-gb' } })
    ).toBe('brand');
    expect(
      gt.determineLocale('de', ['brand'], { brand: { code: 'en-gb' } })
    ).toBeUndefined();
  });
});

describe('LocaleConfig', () => {
  it.each(['Mars/Olympus', ''])(
    'rejects the time zone %j, which Intl does not know',
    (timeZone) => {
      const message = `Invalid time zone ${JSON.stringify(timeZone)}`;
      expect(() => new LocaleConfig({ timeZone })).toThrow(message);
      expect(() => new GT({ timeZone })).toThrow(message);
    }
  );

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

  it('formats dates and times in its time zone unless the call names one', () => {
    const gt = new GT({ sourceLocale: 'en-US', timeZone: 'Asia/Tokyo' });
    const date = new Date('2020-05-06T14:03:02Z');
    const format = (timeZone: string) =>
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone }).format(
        date
      );

    expect(gt.formatDateTime(date, { timeStyle: 'short' })).toBe(
      format('Asia/Tokyo')
    );
    expect(
      gt.formatDateTime(date, { timeStyle: 'short', timeZone: 'UTC' })
    ).toBe(format('UTC'));
  });

  it('changes nothing when an update names a time zone Intl does not know', () => {
    const customMapping = { brand: { code: 'fr' } };
    const gt = new GT({
      sourceLocale: 'en-US',
      locales: ['en-US', 'brand'],
      customMapping,
      timeZone: 'Asia/Tokyo',
    });

    expect(() =>
      gt.setConfig({
        sourceLocale: 'de-DE',
        customMapping: { brand: { code: 'de' } },
        timeZone: 'Mars/Olympus',
      })
    ).toThrow('Invalid time zone "Mars/Olympus"');
    expect(gt.sourceLocale).toBe('en-US');
    expect(gt.customMapping).toBe(customMapping);
    expect(gt.resolveCanonicalLocale('brand')).toBe('fr');
    expect(() => gt.setConfig({ targetLocale: 'fr-FR' })).not.toThrow();
    expect(gt.localeConfig.timeZone).toBe('Asia/Tokyo');
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
