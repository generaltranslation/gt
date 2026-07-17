import { describe, it, expect } from 'vitest';
import type { Updates } from 'generaltranslation/types';
import {
  PSEUDO_DEFAULT_LOCALE,
  buildPseudoTranslations,
  pseudoLocalizeJsx,
  pseudoLocalizeMessage,
  resolvePseudoLocale,
} from '../pseudo.js';

describe('pseudoLocalizeMessage (ICU)', () => {
  it('accents letters, brackets the message, and appends expansion padding', () => {
    expect(pseudoLocalizeMessage('Hello, world!', 'ICU')).toBe(
      '[Ĥéļļö, ŵöŕļđ! ~~~~]'
    );
  });

  it('leaves ICU arguments untouched', () => {
    expect(pseudoLocalizeMessage('Hello, {name}', 'ICU')).toBe(
      '[Ĥéļļö, {name} ~~]'
    );
  });

  it('preserves plural structure, keywords, and # while accenting option text', () => {
    const result = pseudoLocalizeMessage(
      '{count, plural, one {# item} other {# items}}',
      'ICU'
    );
    expect(result.startsWith('[')).toBe(true);
    expect(result).toContain('{count,plural,');
    expect(result).toContain('one{# îţéɱ}');
    expect(result).toContain('other{# îţéɱš}');
    expect(result).not.toContain('item');
    expect(result).toMatch(/ ~+\]$/);
  });

  it('preserves tag names while accenting tag children', () => {
    expect(pseudoLocalizeMessage('<b>Save</b>', 'ICU')).toBe('[<b>Šàṽé</b> ~~]');
  });

  it('preserves number skeletons and adds no padding when there are no letters', () => {
    expect(pseudoLocalizeMessage('{n, number, ::currency/USD}', 'ICU')).toBe(
      '[{n, number, ::currency/USD}]'
    );
  });

  it('falls back to plain accenting when the message is not valid ICU', () => {
    expect(pseudoLocalizeMessage('Broken {', 'ICU')).toBe('[Ɓŕöķéñ { ~~~]');
  });

  it('is deterministic', () => {
    const once = pseudoLocalizeMessage('Hello, {name}', 'ICU');
    const twice = pseudoLocalizeMessage('Hello, {name}', 'ICU');
    expect(once).toBe(twice);
  });

  it('expands message length by at least 30%', () => {
    const source = 'Delete forever';
    const result = pseudoLocalizeMessage(source, 'ICU');
    expect(result.length).toBeGreaterThanOrEqual(Math.ceil(source.length * 1.3));
  });
});

describe('pseudoLocalizeMessage (STRING and I18NEXT)', () => {
  it('treats STRING content as plain text, accenting brace content too', () => {
    expect(pseudoLocalizeMessage('Hello {curly}', 'STRING')).toBe(
      '[Ĥéļļö {çûŕļý} ~~~~]'
    );
  });

  it('preserves i18next {{interpolations}}', () => {
    expect(pseudoLocalizeMessage('Hello {{name}}', 'I18NEXT')).toBe(
      '[Ĥéļļö {{name}} ~~]'
    );
  });

  it('preserves i18next $t() nesting references', () => {
    const result = pseudoLocalizeMessage('See $t(cart.total)', 'I18NEXT');
    expect(result).toContain('$t(cart.total)');
    expect(result).toContain('Šéé');
  });
});

describe('pseudoLocalizeJsx', () => {
  it('accents a plain string child and brackets the top level', () => {
    expect(pseudoLocalizeJsx('Hello')).toEqual(['[', 'Ĥéļļö', ' ~~]']);
  });

  it('leaves variable nodes untouched and skips padding when there is no text', () => {
    expect(pseudoLocalizeJsx([{ k: 'name', v: 'v' }])).toEqual([
      '[',
      { k: 'name', v: 'v' },
      ']',
    ]);
  });

  it('recurses into element children, preserving tag and id', () => {
    expect(pseudoLocalizeJsx({ t: 'div', i: 1, c: 'Hi' })).toEqual([
      '[',
      { t: 'div', i: 1, c: 'Ĥî' },
      ' ~]',
    ]);
  });

  it('transforms branch text but not the branch transformation marker', () => {
    const result = pseudoLocalizeJsx({
      t: 'span',
      i: 3,
      d: { t: 'p', b: { one: 'One item', other: 'Many items' } },
    }) as unknown[];
    const element = result[1] as {
      t: string;
      i: number;
      d: { t: string; b: Record<string, unknown> };
    };
    expect(element.t).toBe('span');
    expect(element.d.t).toBe('p');
    expect(element.d.b.one).toBe('Öñé îţéɱ');
    expect(element.d.b.other).toBe('Ṁàñý îţéɱš');
  });

  it('transforms translatable html content props', () => {
    const result = pseudoLocalizeJsx({
      t: 'input',
      i: 4,
      d: { pl: 'Your name', ti: 'Tip' },
    }) as unknown[];
    const element = result[1] as { d: { pl: string; ti: string } };
    expect(element.d.pl).toBe('Ýöûŕ ñàɱé');
    expect(element.d.ti).toBe('Ţîƥ');
  });

  it('handles nested arrays and elements', () => {
    const result = pseudoLocalizeJsx([
      'Start ',
      { t: 'b', i: 0, c: ['middle'] },
      { k: 'n', v: 'n' },
    ]) as unknown[];
    expect(result[0]).toBe('[');
    expect(result[1]).toBe('Šţàŕţ ');
    expect(result[2]).toEqual({ t: 'b', i: 0, c: ['ɱîđđļé'] });
    expect(result[3]).toEqual({ k: 'n', v: 'n' });
    expect(result[4]).toMatch(/^ ~+\]$/);
  });

  it('does not mutate its input', () => {
    const input = { t: 'div', i: 1, c: ['Hi', { k: 'x' }] };
    const snapshot = JSON.parse(JSON.stringify(input));
    pseudoLocalizeJsx(input);
    expect(input).toEqual(snapshot);
  });
});

describe('buildPseudoTranslations', () => {
  it('maps hashes to pseudo-localized content by data format', () => {
    const updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello, {name}',
        metadata: { hash: 'h1' },
      },
      { dataFormat: 'JSX', source: ['Hi'], metadata: { hash: 'h2' } },
      { dataFormat: 'STRING', source: 'Plain', metadata: { hash: 'h3' } },
      { dataFormat: 'ICU', source: 'No hash', metadata: {} },
    ] as unknown as Updates;

    const result = buildPseudoTranslations(updates);
    expect(Object.keys(result).sort()).toEqual(['h1', 'h2', 'h3']);
    expect(result.h1).toBe(pseudoLocalizeMessage('Hello, {name}', 'ICU'));
    expect(result.h2).toEqual(pseudoLocalizeJsx(['Hi']));
    expect(result.h3).toBe(pseudoLocalizeMessage('Plain', 'STRING'));
  });
});

describe('resolvePseudoLocale', () => {
  it('defaults to en-XA when the flag is boolean', () => {
    expect(resolvePseudoLocale(true, 'en')).toBe(PSEUDO_DEFAULT_LOCALE);
    expect(PSEUDO_DEFAULT_LOCALE).toBe('en-XA');
  });

  it('accepts an explicit pseudo locale', () => {
    expect(resolvePseudoLocale('ar-XB', 'en')).toBe('ar-XB');
  });

  it('rejects the default locale to protect the source file', () => {
    expect(() => resolvePseudoLocale('en', 'en')).toThrow(/default locale/i);
  });

  it('rejects invalid locales', () => {
    expect(() => resolvePseudoLocale('not a locale!', 'en')).toThrow(
      /locale/i
    );
  });
});
