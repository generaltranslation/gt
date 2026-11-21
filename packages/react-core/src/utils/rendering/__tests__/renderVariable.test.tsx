import React from 'react';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { describe, expect, it } from 'vitest';
import {
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
  renderVariable,
} from '../renderPipeline.rsc';
import { getMarker } from '../../marker';
import type { TaggedElement } from '../../types';

function createNumberVariable(value: number): TaggedElement {
  return React.createElement(
    'span',
    {
      'data-_gt': {
        id: 1,
        injectionType: 'manual',
        transformation: 'variable',
        variableType: 'n',
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
    expect(getMarker(element.type)).toEqual({
      kind: 'variable',
      variableType: 'n',
    });
    expect(element.props._locale).toBe('fr');
    expect(element.props._enableI18n).toBe(true);
  });

  it('uses the internal raw variable component for automatic variables', () => {
    const result = renderVariable({
      variableType: 'v',
      variableValue: 'Ada',
      variableOptions: {},
      locales: ['fr', 'en'],
      enableI18n: true,
      injectionType: 'automatic',
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    expect(getMarker(result.type)).toEqual({
      kind: 'variable',
      variableType: 'v',
      automatic: true,
    });
  });

  it('uses the external raw variable component for manual variables', () => {
    const result = renderVariable({
      variableType: 'v',
      variableValue: 'Ada',
      variableOptions: {},
      locales: ['fr', 'en'],
      enableI18n: true,
      injectionType: 'manual',
    });

    expect(React.isValidElement(result)).toBe(true);
    if (!React.isValidElement(result)) return;
    expect(getMarker(result.type)).toEqual({
      kind: 'variable',
      variableType: 'v',
    });
  });

  it('passes the default locale when rendering source variables', () => {
    const result = renderDefaultChildren({
      children: createNumberVariable(5),
      defaultLocale: 'en',
      enableI18n: false,
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

  it.each([
    ['a dialect of the default locale in it', 'en-GB', true, 'en-GB'],
    ['another language in the default locale', 'fr', true, 'en'],
    ['a dialect in the default locale without i18n', 'en-GB', false, 'en'],
  ])(
    'renders the source variables of a <T> for %s',
    (_name, locale, enableI18n, expected) => {
      initializeI18nConfig({
        defaultLocale: 'en',
        locales: ['en', 'en-GB', 'fr'],
      });
      const result = renderPreparedT({
        taggedSourceChildren: createNumberVariable(5),
        targetJsxChildren: undefined,
        locale,
        defaultLocale: 'en',
        enableI18n,
        shouldTranslate: enableI18n && locale === 'fr',
      }) as React.ReactElement<{ _locale: string }>;
      Reflect.deleteProperty(globalThis, '__generaltranslation');

      expect(result.props._locale).toBe(expected);
    }
  );

  it('passes the target locale when rendering translated variables', () => {
    const result = renderTranslatedChildren({
      source: createNumberVariable(5),
      target: { i: 1, v: 'n' },
      locales: ['fr', 'en'],
      enableI18n: true,
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
