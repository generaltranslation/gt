import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
} from '../renderPipeline.rsc';
import { renderPlural } from '../../../components/branches/Plural.shared';
import { Select } from '../../../components/branches/Select';
import { Plural } from '../../../components/branches/Plural';
import type {
  TaggedElement,
  TaggedElementProps,
  TranslatedChildren,
} from '../../types';

const renderArgs = {
  defaultLocale: 'en',
  enableI18n: true,
};

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createSelectElement(
  value: string | number | boolean,
  branches: Record<string, string>
): TaggedElement {
  const props = {
    'data-_gt': {
      id: 1,
      injectionType: 'manual',
      transformation: 'select',
      branches,
    },
    value,
  } as unknown as TaggedElementProps;
  return React.createElement('span', props) as TaggedElement;
}

function createPluralElement(
  n: number,
  branches: Record<string, React.ReactNode>,
  ordinal?: boolean
): TaggedElement {
  const props = {
    'data-_gt': {
      id: 1,
      injectionType: 'manual',
      transformation: ordinal ? 'ordinal' : 'plural',
      branches,
    },
    n,
  } as unknown as TaggedElementProps;
  return React.createElement('span', props) as TaggedElement;
}

function createTranslatedPluralTarget(
  branch: string | number | boolean | undefined
): TranslatedChildren {
  return {
    d: { b: { other: branch } },
  } as unknown as TranslatedChildren;
}

describe('branch rendering', () => {
  it('selects numeric branch keys when rendering default children', () => {
    const result = renderDefaultChildren({
      ...renderArgs,
      children: createSelectElement(0, { '0': 'Zero' }),
    });

    expect(result).toBe('Zero');
  });

  it('selects boolean branch keys when rendering translated children', () => {
    const result = renderTranslatedChildren({
      source: createSelectElement(false, { false: 'Off' }),
      target: {
        d: { b: { false: 'Apagado' } },
      },
      locales: ['es'],
      enableI18n: true,
    });

    expect(result).toBe('Apagado');
  });

  it('renders the other branch for a value with no branch', () => {
    const source = createSelectElement('guest', {
      admin: 'Admin',
      other: 'Someone',
    });
    expect(renderDefaultChildren({ ...renderArgs, children: source })).toBe(
      'Someone'
    );
    expect(
      renderTranslatedChildren({
        source,
        target: { d: { b: { admin: 'Administrador', other: 'Alguien' } } },
        locales: ['es'],
        enableI18n: true,
      })
    ).toBe('Alguien');
  });
});

describe('plural rendering', () => {
  it('preserves numeric zero branch content when rendering default children', () => {
    const result = renderDefaultChildren({
      ...renderArgs,
      children: createPluralElement(2, { other: 0 }),
    });

    expect(result).toBe(0);
  });

  it('preserves boolean branch content when rendering translated children', () => {
    const result = renderTranslatedChildren({
      source: createPluralElement(2, { other: false }),
      target: createTranslatedPluralTarget(false),
      locales: ['en'],
      enableI18n: true,
    });

    expect(result).toBe(false);
  });

  it('picks an exact branch before a category in source and translation', () => {
    const source = createPluralElement(0, {
      '=0': 'No items',
      other: 'Items',
    });
    expect(renderDefaultChildren({ ...renderArgs, children: source })).toBe(
      'No items'
    );
    expect(
      renderTranslatedChildren({
        source,
        target: {
          d: { b: { '=0': 'Sin elementos', other: 'Elementos' } },
        } as unknown as TranslatedChildren,
        locales: ['es'],
        enableI18n: true,
      })
    ).toBe('Sin elementos');
  });

  it('pairs the branch a translation picks with the source other branch', () => {
    // Russian has no =0 branch and counts 0 as "many", which English lacks.
    const items = React.createElement('b', { 'data-_gt': { id: 2 } }, 'items');
    const result = renderTranslatedChildren({
      source: createPluralElement(0, { '=0': 'None', other: items }),
      target: {
        d: {
          b: {
            one: { i: 2, c: 'элемент' },
            few: { i: 2, c: 'элемента' },
            many: { i: 2, c: 'элементов' },
            other: { i: 2, c: 'элемента' },
          },
        },
      } as unknown as TranslatedChildren,
      locales: ['ru'],
      enableI18n: true,
    });

    expect(result).toMatchObject({
      type: 'b',
      props: { children: 'элементов' },
    });
  });

  // The host has at most one of these as its own locale, so the others fail
  // if the plural is left to the host's rules.
  it.each(['ar', 'pl', 'ja'])(
    'picks the branch of a locale Intl has no data for by the rules of the default locale %s',
    (defaultLocale) => {
      const categories = {
        zero: 'zero',
        one: 'one',
        two: 'two',
        few: 'few',
        many: 'many',
        other: 'other',
      };
      const counts = [0, 1, 2, 5, 21];
      const render = (
        source: (n: number) => TaggedElement,
        branches: Record<string, string>
      ) =>
        counts.map((n) =>
          renderPreparedT({
            taggedSourceChildren: source(n),
            targetJsxChildren: { d: { b: branches } },
            locale: 'qaa',
            defaultLocale,
            enableI18n: true,
            shouldTranslate: true,
          })
        );
      const expected = counts.map((n) =>
        new Intl.PluralRules(defaultLocale).select(n)
      );

      expect(
        render((n) => createPluralElement(n, { other: 'source' }), categories)
      ).toEqual(expected);
      // The translation has no branch, so the source picks, as does the
      // plural in the branch it picks.
      expect(
        render(
          (n) =>
            createPluralElement(n, {
              other: createPluralElement(n, categories),
            }),
          {}
        )
      ).toEqual(expected);
    }
  );

  describe('a count in a translated branch', () => {
    // Russian picks "one" for 21 too, so its branch shows the count, which
    // the English "one" branch leaves out.
    const count = { i: 2, v: '#' };
    const tagged = (id: number, tag: object, props: object = {}) =>
      ({
        'data-_gt': { id, injectionType: 'manual', ...tag },
        ...props,
      }) as unknown as TaggedElementProps;
    const size = React.createElement(
      'span',
      tagged(2, { transformation: 'variable', variableType: 'n' }),
      100
    );
    const render = (
      n: unknown,
      branches: Record<string, React.ReactNode>,
      one: unknown
    ) =>
      renderTranslatedChildren({
        source: createPluralElement(n as number, branches),
        target: { d: { b: { one } } } as unknown as TranslatedChildren,
        locales: ['ru'],
        enableI18n: true,
      });
    const shows = (value: unknown) => ({
      props: { children: { props: { children: value } } },
    });

    it('is the n of the plural, which the source branch need not show', () => {
      expect(
        render(21, { one: 'One file', other: 'Files' }, [count, ' файл'])
      ).toMatchObject([shows(21), { props: { children: ' файл' } }]);
      expect(render(21, { one: 'One file' }, count)).toMatchObject(
        shows(21).props.children
      );
    });

    it('is not the variable of the same id in the source branch', () => {
      expect(
        render(21, { one: [size, ' MB file'] }, [count, { i: 2, v: 'n' }])
      ).toMatchObject([shows(21), shows(100)]);
    });

    it('reaches into elements and a <Select>, and stops at a nested <Plural>', () => {
      const bold = React.createElement('b', tagged(2, {}), 'One file');
      expect(render(21, { one: bold }, { i: 2, c: [count] })).toMatchObject({
        type: 'b',
        props: { children: [shows(21)] },
      });

      const branch = React.createElement(
        'span',
        tagged(
          2,
          { transformation: 'select', branches: { a: 'file' } },
          {
            value: 'a',
          }
        )
      );
      expect(
        render(21, { one: branch }, { i: 2, d: { b: { a: [count] } } })
      ).toMatchObject([shows(21)]);

      const plural = React.createElement(
        'span',
        tagged(
          2,
          { transformation: 'plural', branches: { other: 'files' } },
          {
            n: 5,
          }
        )
      );
      expect(
        render(21, { one: plural }, { i: 2, d: { b: { many: [count] } } })
      ).toMatchObject([shows(5)]);
    });

    it('is the source variable of its id where no plural gives a count', () => {
      const result = renderTranslatedChildren({
        source: [size, ' MB'],
        target: [count, ' МБ'] as unknown as TranslatedChildren,
        locales: ['ru'],
        enableI18n: true,
      });

      expect(result).toMatchObject([
        shows(100),
        { props: { children: ' МБ' } },
      ]);
    });

    it('renders nothing for an n that is not a number', () => {
      const result = renderTranslatedChildren({
        source: createPluralElement('x' as unknown as number, {
          other: 'Files',
        }),
        target: {
          d: { b: { other: [count] } },
        } as unknown as TranslatedChildren,
        locales: ['ru'],
        enableI18n: true,
      });

      expect(result).toMatchObject([shows(undefined)]);
    });
  });

  it.each([
    [true, ':a'],
    [false, ':e'],
  ])(
    'picks among the branches of the translation with ordinal=%s rules',
    (ordinal, expected) => {
      // Swedish counts 2 as "one" in ordinals and as "other" in cardinals.
      const result = renderTranslatedChildren({
        source: createPluralElement(
          2,
          { one: '1st', two: '2nd', other: 'nth' },
          ordinal
        ),
        target: {
          d: { b: { one: ':a', other: ':e' } },
        } as unknown as TranslatedChildren,
        locales: ['sv'],
        enableI18n: true,
      });

      expect(result).toBe(expected);
    }
  );

  it('renders the source branch when the translation has no branch', () => {
    const result = renderTranslatedChildren({
      source: createPluralElement(2, { other: 'Items' }),
      target: createTranslatedPluralTarget(undefined),
      locales: ['en'],
      enableI18n: true,
    });

    expect(result).toBe('Items');
  });

  it('lets the source pick when the translation has no branch for the value', () => {
    const result = renderTranslatedChildren({
      source: createSelectElement('a', { a: 'A', b: 'B' }),
      target: { d: { b: { b: 'B traduit' } } } as unknown as TranslatedChildren,
      locales: ['fr'],
      enableI18n: true,
    });

    expect(result).toBe('A');
  });
});

describe('shared plural component renderer', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({ defaultLocale: 'en' });
  });

  afterEach(resetGTGlobals);

  it('preserves falsy content in the shared plural component renderer', () => {
    expect(
      renderPlural({
        _enableI18n: true,
        _locale: 'en',
        n: 2,
        children: 0,
      })
    ).toBe(0);
    expect(
      renderPlural({
        _enableI18n: true,
        _locale: 'en',
        n: 2,
        children: false,
      })
    ).toBe(false);
  });
});

describe('branch component prop types', () => {
  it('accepts complete branches and rejects the rest at compile time', () => {
    const status = 'admin' as 'admin' | 'guest';
    const name = 'admin' as string;
    const isAdmin = true as boolean;
    const gender = 'other' as 'female' | 'other';
    const mode = 'admin' as 'admin' | 'value';
    const side = 'branch' as 'branch' | 'trunk';
    const elements = [
      <Select key={0} value={status} admin='A' guest='G' />,
      <Select key={1} value={status} admin='A' children='O' />,
      <Select key={2} value={isAdmin} true='A' false='G' />,
      <Select key={3} value={name} admin='A' children='O' />,
      // @ts-expect-error a finite union needs a branch for every value, or children
      <Select key={4} value={status} admin='A' />,
      // @ts-expect-error any string needs children
      <Select key={5} value={name} admin='A' />,
      // @ts-expect-error not a value of the union
      <Select key={6} value={status} owner='O' children='O' />,
      <Plural key={8} n={1} _0='None' one='One' children='Many' />,
      <Plural key={9} n={1n} children='Many' />,
      // @ts-expect-error children are required
      <Plural key={10} n={1} one='One' />,
      // @ts-expect-error singular is not a plural category
      <Plural key={11} n={1} singular='One' children='Many' />,
      // @ts-expect-error locales is not a prop
      <Plural key={12} n={1} locales={['en']} children='Many' />,
      // @ts-expect-error _locale is internal
      <Plural key={13} n={1} _locale='en' children='Many' />,
      // @ts-expect-error n is a number or a bigint
      <Plural key={14} n='1' children='Many' />,
      // @ts-expect-error other is not a prop: the fallback is the children
      <Plural key={15} n={1} other='Many' children='Fallback' />,
      <Select key={16} value={gender} female='F' children='O' />,
      // @ts-expect-error the value other has no prop, so children are required
      <Select key={17} value={gender} female='F' />,
      <Select key={18} value={mode} admin='A' children='O' />,
      // @ts-expect-error the value named value has no prop, so children are required
      <Select key={19} value={mode} admin='A' />,
      <Select key={20} value={side} branch='B' trunk='T' />,
    ];
    expect(elements).toHaveLength(20);
  });
});
