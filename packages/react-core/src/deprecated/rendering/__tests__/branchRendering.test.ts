import React from 'react';
import { describe, expect, it } from 'vitest';
import renderDefaultChildren from '../renderDefaultChildren';
import renderTranslatedChildren from '../renderTranslatedChildren';
import type {
  RenderVariable,
  TaggedElement,
  TaggedElementProps,
} from '../../types-dir/types';

const renderVariable: RenderVariable = () => null;

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
  branches: Record<string, string | number | boolean>
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

describe('branch rendering', () => {
  it('selects numeric branch keys when rendering default children', () => {
    const result = renderDefaultChildren({
      children: createBranchElement(0, { '0': 'Zero' }),
      defaultLocale: 'en',
      renderVariable,
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
      renderVariable,
    });

    expect(result).toBe('Apagado');
  });
});

describe('plural rendering', () => {
  it('preserves numeric zero branch content when rendering default children', () => {
    const result = renderDefaultChildren({
      children: createPluralElement(2, { other: 0 }),
      defaultLocale: 'en',
      renderVariable,
    });

    expect(result).toBe(0);
  });

  it('preserves boolean branch content when rendering translated children', () => {
    const result = renderTranslatedChildren({
      source: createPluralElement(2, { other: false }),
      target: {
        d: { b: { other: false } },
        c: 'Fallback translation',
      },
      locales: ['en'],
      renderVariable,
    });

    expect(result).toBe(false);
  });
});
