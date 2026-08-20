import { describe, expect, it } from 'vitest';

import { flattenEntry, type GtJsxChildren } from '../gtjson';

describe('flattenEntry', () => {
  it('returns null for a null/undefined entry (untranslated)', () => {
    expect(flattenEntry(null)).toBeNull();
    expect(flattenEntry(undefined)).toBeNull();
  });

  it('flattens a bare string (STRING/ICU message) to one text leaf', () => {
    expect(flattenEntry('Hola')).toEqual([{ text: 'Hola' }]);
  });

  it('flattens each JSX child string as its own leaf, in order', () => {
    const entry: GtJsxChildren = ['Bienvenido ', 'de nuevo'];
    expect(flattenEntry(entry)).toEqual([
      { text: 'Bienvenido ' },
      { text: 'de nuevo' },
    ]);
  });

  it('recurses into element children ({ t, c })', () => {
    // 'Welcome <strong>John</strong> to our <a>application</a>' → translated
    const entry: GtJsxChildren = [
      'Bienvenido ',
      { t: 'strong', c: ['Juan'] },
      ' a nuestra ',
      { t: 'a', c: ['aplicación'] },
    ];
    expect(flattenEntry(entry)).toEqual([
      { text: 'Bienvenido ' },
      { text: 'Juan' },
      { text: ' a nuestra ' },
      { text: 'aplicación' },
    ]);
  });

  it('recurses through nested elements', () => {
    const entry: GtJsxChildren = {
      t: 'div',
      c: [{ t: 'span', c: ['Hola ', { t: 'b', c: ['mundo'] }] }],
    };
    expect(flattenEntry(entry)).toEqual([{ text: 'Hola ' }, { text: 'mundo' }]);
  });

  it('emits a variable placeholder for a variable node ({ k })', () => {
    // 'Hello <Var>{name}</Var>' → 'Hola {name}'
    const entry: GtJsxChildren = ['Hola ', { i: 1, k: 'name', v: 'v' }];
    expect(flattenEntry(entry)).toEqual([
      { text: 'Hola ' },
      { variable: true },
    ]);
  });

  it('treats an HTML void element as zero leaves (e.g. <br/>)', () => {
    expect(flattenEntry([{ t: 'br' }, 'x'])).toEqual([{ text: 'x' }]);
  });

  it('treats a childless value-rendering component as a placeholder leaf', () => {
    // '<DateTime/> – <DateTime/>' → the dates render as text nodes we keep on source.
    const entry: GtJsxChildren = [
      { t: 'LocalizedDateTime', i: 1 },
      ' – ',
      { t: 'LocalizedDateTime', i: 2 },
    ];
    expect(flattenEntry(entry)).toEqual([
      { variable: true },
      { text: ' – ' },
      { variable: true },
    ]);
  });

  it('returns null for a plural/branch (no single rendered form)', () => {
    const entry: GtJsxChildren = [
      {
        t: 'span',
        i: 1,
        d: { t: 'p', b: { one: ['1 item'], other: ['n items'] } },
      },
    ];
    expect(flattenEntry(entry)).toBeNull();
  });

  it('strips GT field separators (U+001C–U+001F) from string leaves', () => {
    expect(flattenEntry('abc')).toEqual([{ text: 'abc' }]);
  });
});
