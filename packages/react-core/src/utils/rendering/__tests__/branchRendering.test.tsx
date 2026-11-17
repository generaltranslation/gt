import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '../renderPipeline.rsc';
import { renderPlural } from '../../../components/branches/Plural.shared';
import { Branch } from '../../../components/branches/Branch';
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

function createBranchElement(
  branch: string | number | boolean,
  branches: Record<string, string>
): TaggedElement {
  const props = {
    'data-_gt': {
      id: 1,
      injectionType: 'manual',
      transformation: 'branch',
      branches,
    },
    branch,
  } as unknown as TaggedElementProps;
  return React.createElement('span', props) as TaggedElement;
}

function createPluralElement(
  n: number,
  branches: Record<string, React.ReactNode>
): TaggedElement {
  const props = {
    'data-_gt': {
      id: 1,
      injectionType: 'manual',
      transformation: 'plural',
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
      children: createBranchElement(0, { '0': 'Zero' }),
    });

    expect(result).toBe('Zero');
  });

  it('selects boolean branch keys when rendering translated children', () => {
    const result = renderTranslatedChildren({
      source: createBranchElement(false, { false: 'Off' }),
      target: {
        d: { b: { false: 'Apagado' } },
      },
      locales: ['es'],
      enableI18n: true,
    });

    expect(result).toBe('Apagado');
  });

  it('renders the other branch for a value with no branch', () => {
    const source = createBranchElement('guest', {
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

  it('renders the source branch when the translation has no branch', () => {
    const result = renderTranslatedChildren({
      source: createPluralElement(2, { other: 'Items' }),
      target: createTranslatedPluralTarget(undefined),
      locales: ['en'],
      enableI18n: true,
    });

    expect(result).toBe('Items');
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
        other: 0,
      })
    ).toBe(0);
    expect(
      renderPlural({
        _enableI18n: true,
        _locale: 'en',
        n: 2,
        other: false,
      })
    ).toBe(false);
  });
});

describe('branch component prop types', () => {
  it('accepts complete branches and rejects the rest at compile time', () => {
    const status = 'admin' as 'admin' | 'guest';
    const name = 'admin' as string;
    const isAdmin = true as boolean;
    const elements = [
      <Branch key={0} branch={status} admin='A' guest='G' />,
      <Branch key={1} branch={status} admin='A' other='O' />,
      <Branch key={2} branch={isAdmin} true='A' false='G' />,
      <Branch key={3} branch={name} admin='A' other='O' />,
      // @ts-expect-error a finite union needs a branch for every value, or other
      <Branch key={4} branch={status} admin='A' />,
      // @ts-expect-error any string needs other
      <Branch key={5} branch={name} admin='A' />,
      // @ts-expect-error not a value of the union
      <Branch key={6} branch={status} owner='O' other='O' />,
      // @ts-expect-error children are not a fallback
      <Branch key={7} branch={name} other='O' children='Fallback' />,
      <Plural key={8} n={1} _0='None' one='One' other='Many' />,
      <Plural key={9} n={1n} other='Many' />,
      // @ts-expect-error other is required
      <Plural key={10} n={1} one='One' />,
      // @ts-expect-error singular is not a plural category
      <Plural key={11} n={1} singular='One' other='Many' />,
      // @ts-expect-error locales is not a prop
      <Plural key={12} n={1} locales={['en']} other='Many' />,
      // @ts-expect-error _locale is internal
      <Plural key={13} n={1} _locale='en' other='Many' />,
      // @ts-expect-error n is a number or a bigint
      <Plural key={14} n='1' other='Many' />,
      // @ts-expect-error children are not a fallback
      <Plural key={15} n={1} other='Many' children='Fallback' />,
    ];
    expect(elements).toHaveLength(16);
  });
});
