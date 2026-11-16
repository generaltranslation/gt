import { formatCutoff } from '@generaltranslation/format';
import type { MessageTree } from '@generaltranslation/icu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { InlineTranslations } from '../../translation-functions/inline/inlineTranslations';
import { t } from '../../unstable';
import { buildMessage } from '../buildMessage';
import { getGT, type GTOptions } from '../gt';
import { hashSource } from 'generaltranslation/id';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const keyOf = (strings: TemplateStringsArray) =>
  hashSource({
    source: buildMessage(strings, []).tree,
    dataFormat: 'MESSAGE_TREE',
  });

/** Options with the callback the compiler injects. */
const inline = (callback: InlineTranslations<MessageTree>) =>
  ({ $_inline: callback }) as GTOptions;

const embedded =
  (translations: Record<string, MessageTree>) => (locale: string) =>
    translations[locale];

function setup(locale = 'fr') {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr', 'es'] });
  setI18nCache(
    new I18nCache({
      loadTranslations: vi.fn(async (requested: string) =>
        requested === 'fr' ? { [keyOf`Loaded`]: 'Chargé' } : {}
      ),
    })
  );
  setWritableConditionStore({
    getLocale: () => locale,
    getEnableI18n: () => true,
  });
  return getGT({ locale, enableI18n: true });
}

describe('unstable gt inline translations', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('uses the translation embedded at the call site', async () => {
    const gt = await setup();
    expect(gt(inline(embedded({ fr: 'Bonjour' })))`Hello`).toBe('Bonjour');
  });

  it('renders variables into embedded translations', async () => {
    const gt = await setup();
    const name = 'Alice';
    expect(
      gt(inline(embedded({ fr: ['Salut, ', ['name'], ' !'] })))`Hello, ${{
        name,
      }}!`
    ).toBe('Salut, Alice !');
  });

  it('falls back to loaded translations when the callback returns undefined', async () => {
    const gt = await setup();
    expect(gt(inline(embedded({ es: 'Cargado' })))`Loaded`).toBe('Chargé');
  });

  it('keeps the other options', async () => {
    const gt = await setup();
    const callback = vi.fn(() => 'Bonjour le monde');
    expect(gt({ maxChars: 7, ...inline(callback) })`Hello world`).toBe(
      formatCutoff('Bonjour le monde', { locales: 'fr', maxChars: 7 })
    );
    expect(callback).toHaveBeenCalledWith('fr');
  });

  it('is not called for a locale that needs no translation', async () => {
    const gt = await setup('en');
    const callback = vi.fn(() => 'Bonjour');
    expect(gt(inline(callback))`Hello`).toBe('Hello');
    expect(callback).not.toHaveBeenCalled();
  });

  it('is not called when i18n is disabled', async () => {
    await setup();
    const gt = await getGT({ locale: 'fr', enableI18n: false });
    const callback = vi.fn(() => 'Bonjour');
    expect(gt(inline(callback))`Hello`).toBe('Hello');
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores an embedded value that is not a message tree', async () => {
    const gt = await setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(gt(inline((() => ({ not: 'a tree' })) as never))`Loaded`).toBe(
      'Loaded'
    );
    warn.mockRestore();
  });

  it('is used by the global t', async () => {
    await setup();
    expect(t(inline(embedded({ fr: 'Bonjour' })))`Hello`).toBe('Bonjour');
  });
});
