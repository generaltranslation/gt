import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import renderDefaultChildren from '../renderDefaultChildren';
import renderTranslatedChildren from '../renderTranslatedChildren';
import { renderVariable } from '../renderVariable';
import type { RenderVariable, TaggedElement } from '../../types';

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

  it('uses injection type to preserve automatic variable components', () => {
    const result = renderVariable({
      variableType: 'n',
      variableValue: 1000,
      variableOptions: {},
      locales: ['fr', 'en'],
      enableI18n: true,
      injectionType: 'automatic',
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    const element = result as React.ReactElement<{
      _locale: string;
      _enableI18n: boolean;
    }>;
    expect((element.type as { _gtt?: string })._gtt).toBe('variable-number');
    expect(element.props._locale).toBe('fr');
    expect(element.props._enableI18n).toBe(true);
  });

  it('renders automatic raw variables without a wrapper', () => {
    const result = renderVariable({
      variableType: 'v',
      variableValue: 'Ada',
      variableOptions: {},
      locales: ['fr', 'en'],
      enableI18n: true,
      injectionType: 'automatic',
    });

    expect(result).toBe('Ada');
  });

  it('passes the default locale when rendering source variables', () => {
    const stubRenderVariable = vi.fn(() => null) as RenderVariable;

    renderDefaultChildren({
      children: createNumberVariable(5),
      defaultLocale: 'en',
      renderVariable: stubRenderVariable,
    });

    expect(stubRenderVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        locales: ['en'],
        enableI18n: false,
      })
    );
  });

  it('passes the target locale when rendering translated variables', () => {
    const stubRenderVariable = vi.fn(() => null) as RenderVariable;

    renderTranslatedChildren({
      source: createNumberVariable(5),
      target: { k: 'count', v: 'n' },
      locales: ['fr', 'en'],
      renderVariable: stubRenderVariable,
    });

    expect(stubRenderVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        locales: ['fr', 'en'],
        enableI18n: true,
      })
    );
  });
});
