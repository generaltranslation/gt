import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '../renderPipeline';
import { renderPlural } from '../../../components/branches/Plural.shared';
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
    children: 'Fallback',
  } as unknown as TaggedElementProps;
  return React.createElement('span', props) as TaggedElement;
}

function createPluralElement(
  n: number,
  branches: Record<string, string | number | boolean | undefined>
): TaggedElement {
  const props = {
    'data-_gt': {
      id: 1,
      injectionType: 'manual',
      transformation: 'plural',
      branches,
    },
    n,
    children: 'Fallback',
  } as unknown as TaggedElementProps;
  return React.createElement('span', props) as TaggedElement;
}

function createTranslatedPluralTarget(
  branch: string | number | boolean | undefined
): TranslatedChildren {
  return {
    d: { b: { other: branch } },
    c: 'Fallback translation',
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
        c: 'Fallback translation',
      },
      locales: ['es'],
      enableI18n: true,
    });

    expect(result).toBe('Apagado');
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

  it('falls back for undefined branch content when rendering default children', () => {
    const result = renderDefaultChildren({
      ...renderArgs,
      children: createPluralElement(2, { other: undefined }),
    });

    expect(result).toBe('Fallback');
  });

  it('falls back for undefined branch content when rendering translated children', () => {
    const result = renderTranslatedChildren({
      source: createPluralElement(2, { other: undefined }),
      target: createTranslatedPluralTarget(undefined),
      locales: ['en'],
      enableI18n: true,
    });

    expect(result).toBe('Fallback translation');
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
        children: 'Fallback',
        n: 2,
        other: 0,
      })
    ).toBe(0);
    expect(
      renderPlural({
        _enableI18n: true,
        _locale: 'en',
        children: 'Fallback',
        n: 2,
        other: false,
      })
    ).toBe(false);
  });

  it('falls back for undefined content in the shared plural component renderer', () => {
    expect(
      renderPlural({
        _enableI18n: true,
        _locale: 'en',
        children: 'Fallback',
        n: 2,
        other: undefined,
      })
    ).toBe('Fallback');
  });
});
