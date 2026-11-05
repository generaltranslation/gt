import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { declareVar, derive } from 'generaltranslation/internal';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { getGT } from '../../translation-functions/internal/getGT';
import { msg } from '../../translation-functions/msg/msg';
import { decodeOptions } from '../../translation-functions/msg/decodeOptions';
import { hashIcuMessage, withIcuHash } from '../hashIcuMessage';
import { hashMessage } from '../hashMessage';

// 'Hello {_gt_, select, other {World}} and {_gt_, select, other {Ana}}'
const message = `Hello ${derive(declareVar('World'))} and ${declareVar('Ana')}`;
// hashSource({ source: indexVars(message), dataFormat: 'ICU' }), the key
// gt-i18n computed before hashMessage stopped indexing ICU messages.
const legacyHash = '8fd28997b591e4d1';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('legacy ICU hashes', () => {
  beforeEach(resetGTGlobals);
  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
  });

  it('hashIcuMessage keeps the indexed legacy hash', () => {
    expect(hashIcuMessage(message, { $format: 'ICU' })).toBe(legacyHash);
  });

  it('msg() encodes the legacy hash', () => {
    expect(decodeOptions(msg(message, {}))?.$_hash).toBe(legacyHash);
  });

  it('gt() looks the message up by the legacy hash', async () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setI18nCache(
      new I18nCache({
        loadTranslations: vi
          .fn()
          .mockResolvedValue({ [legacyHash]: 'Bonjour {_gt_1} et {_gt_2}' }),
      })
    );
    setWritableConditionStore({
      getLocale: () => 'fr',
      getEnableI18n: () => true,
      setLocale: () => {},
      setEnableI18n: () => {},
    });

    const gt = await getGT();

    expect(gt(message)).toBe('Bonjour World et Ana');
  });

  it('withIcuHash sets $_hash only for ICU messages that need indexing', () => {
    expect(withIcuHash(message, { $format: 'ICU' })).toEqual({
      $format: 'ICU',
      $_hash: legacyHash,
    });
    const plain = { $format: 'ICU' as const };
    expect(withIcuHash('Hello {name}', plain)).toBe(plain);
    const string = { $format: 'STRING' as const };
    expect(withIcuHash(message, string)).toBe(string);
  });

  it('hashMessage matches hashIcuMessage for ICU messages without _gt_', () => {
    expect(hashMessage('Hello {name}', { $format: 'ICU' })).toBe(
      hashIcuMessage('Hello {name}', { $format: 'ICU' })
    );
  });

  it('hashMessage throws in development for ICU messages that need indexing', () => {
    expect(() => hashMessage(message, { $format: 'ICU' })).toThrow(
      /without a precomputed \$_hash/
    );
  });

  it('renders malformed ICU with _gt_ as the source instead of throwing', async () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setI18nCache(
      new I18nCache({ loadTranslations: vi.fn().mockResolvedValue({}) })
    );
    setWritableConditionStore({
      getLocale: () => 'en',
      getEnableI18n: () => true,
      setLocale: () => {},
      setEnableI18n: () => {},
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const gt = await getGT();
      expect(gt('Literal _gt_ {')).toBe('Literal _gt_ {');
      expect(() =>
        withIcuHash('Literal _gt_ {', { $format: 'ICU' })
      ).not.toThrow();
    } finally {
      warn.mockRestore();
    }
  });

  it('hashMessage does not throw in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => hashMessage(message, { $format: 'ICU' })).not.toThrow();
  });
});
