import '../../unstable-icu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { buildMessage } from '../buildMessage';
import { createGT } from '../gt';
import { n, number, part, plural } from '../placeholders';
import { hashMessage, type MessageTreeMetadata } from '../renderMessage';

// The entry registers the parser on the GT globals, so this file keeps them.
initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });

const keyWith =
  (metadata: MessageTreeMetadata) =>
  (strings: TemplateStringsArray, ...holes: unknown[]) =>
    hashMessage(buildMessage(strings, holes).tree, metadata);
const key = keyWith({});

const price = 9.5;
const count = 2;

function frenchGT(catalog: Record<string, unknown>) {
  return createGT({
    getLocale: () => 'fr',
    lookupTranslation: (locale, hash) =>
      locale === 'fr' ? catalog[hash] : undefined,
  });
}

describe('ICU string translations with gt-i18n/unstable/icu', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("formats an ICU string with its source's formats", () => {
    const gt = frenchGT({
      [key`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`]:
        'Total : {price, number}',
    });
    expect(
      gt`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`
    ).toBe(
      `Total : ${new Intl.NumberFormat('fr', { style: 'currency', currency: 'USD' }).format(price)}`
    );
  });

  it('formats plurals, with the count as #', () => {
    const gt = frenchGT({
      [key`${plural({ count }, { one: part`${n} file`, other: part`${n} files` })}`]:
        '{count, plural, one {# fichier} other {# fichiers}}',
    });
    expect(
      gt`${plural({ count }, { one: part`${n} file`, other: part`${n} files` })}`
    ).toBe('2 fichiers');
  });

  it('reads message trees as before', () => {
    const gt = frenchGT({ [key`Save`]: ['Enregistrer'] });
    expect(gt`Save`).toBe('Enregistrer');
  });

  it.each([
    [
      'uses other variables',
      'Total : {cost, number}',
      'does not exist in the source',
    ],
    ['is not valid ICU', 'Total : {price, number', 'expect'],
  ])(
    'renders the source and warns once when a translation %s',
    (context, icu, detail) => {
      const hash = keyWith({ context })`Total: ${number({ price })}`;
      const gt = frenchGT({ [hash]: icu })({ context });
      const source = `Total: ${new Intl.NumberFormat('en').format(price)}`;
      expect(gt`Total: ${number({ price })}`).toBe(source);
      expect(gt`Total: ${number({ price })}`).toBe(source);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('ICU translation');
      expect(String(warn.mock.calls[0][0]).toLowerCase()).toContain(detail);
    }
  );
});
