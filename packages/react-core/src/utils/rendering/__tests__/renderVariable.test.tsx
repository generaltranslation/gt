import React from 'react';
import { describe, expect, it } from 'vitest';
import renderDefaultChildren from '../renderDefaultChildren';
import renderTranslatedChildren from '../renderTranslatedChildren';
import { renderVariable } from '../renderVariable';
import type { TaggedElement } from '../../types';

function createNumberVariable(value: number): TaggedElement {
  return React.createElement(
    'span',
    {
      'data-_gt': {
        id: 1,
        injectionType: 'manual',
        transformation: 'variable',
        variableType: 'number',
      },
    },
    value
  ) as TaggedElement;
}

describe('renderVariable locale handling', () => {
  it('passes the explicit locale to internal variable components', () => {
    const result = renderVariable({
      variableType: 'n',
      variableValue: 1000,
      variableOptions: {},
      locales: ['fr', 'en'],
      enableI18n: true,
      injectionType: 'manual',
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    const element = result as React.ReactElement<{
      _locale: string;
      _enableI18n: boolean;
    }>;
    expect(element.props._locale).toBe('fr');
    expect(element.props._enableI18n).toBe(true);
  });

  it('passes the default locale when rendering source variables', () => {
    const result = renderDefaultChildren({
      children: createNumberVariable(5),
      defaultLocale: 'en',
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    const element = result as React.ReactElement<{
      _locale: string;
      _enableI18n: boolean;
    }>;
    expect(element.props._locale).toBe('en');
    expect(element.props._enableI18n).toBe(false);
  });

  it('passes the target locale when rendering translated variables', () => {
    const result = renderTranslatedChildren({
      source: createNumberVariable(5),
      target: { k: 'count', v: 'n' },
      locales: ['fr', 'en'],
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    const element = result as React.ReactElement<{
      _locale: string;
      _enableI18n: boolean;
    }>;
    expect(element.props._locale).toBe('fr');
    expect(element.props._enableI18n).toBe(true);
  });
});
