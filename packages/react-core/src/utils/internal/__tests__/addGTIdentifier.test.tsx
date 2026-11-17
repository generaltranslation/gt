import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '../../rendering/renderPipeline';
import { Plural } from '../../../components/branches/Plural';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { Var } from '../../../components/variables/Var';
import type { GTTag, TaggedElement, TranslatedChildren } from '../../types';

function gtTag(node: unknown): GTTag {
  return (node as TaggedElement).props['data-_gt'];
}

// Resolves function components to their output so tests can read the text a
// <T> would render without a DOM renderer.
function renderText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderText).join('');
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === 'function') {
      return renderText(
        (node.type as (props: unknown) => ReactNode)(node.props)
      );
    }
    return renderText(node.props.children);
  }
  return '';
}

// https://github.com/generaltranslation/gt/issues/2077
describe('addGTIdentifier with <RelativeTime>', () => {
  it('tags <RelativeTime> as a relativetime variable', () => {
    const tagged = addGTIdentifier(<RelativeTime value={-3} unit='day' />);

    expect(gtTag(tagged)).toMatchObject({
      transformation: 'variable',
      variableType: 'relativetime',
      injectionType: 'manual',
    });
  });

  it('writes the same variable shape the extractors hash', () => {
    const tagged = addGTIdentifier([
      'Posted ',
      <RelativeTime key='time' value={-3} unit='day' />,
    ]);

    expect(writeChildrenAsObjects(tagged)).toEqual([
      'Posted ',
      { i: 1, k: '_gt_1', v: 'rt' },
    ]);
  });

  it('marks the compiler-injected <RelativeTime> as automatic', () => {
    const tagged = addGTIdentifier(
      <GtInternalRelativeTime value={-3} unit='day' />
    );

    expect(gtTag(tagged)).toMatchObject({
      variableType: 'relativetime',
      injectionType: 'automatic',
    });
  });

  it('tags <RelativeTime> inside a Plural branch prop', () => {
    const tagged = addGTIdentifier(
      <Plural
        n={1}
        one={<RelativeTime value={-3} unit='day' />}
        other='Later'
      />
    );

    expect(gtTag(gtTag(tagged).branches?.one)).toMatchObject({
      variableType: 'relativetime',
    });
  });

  it('stores an exact Plural branch under its ICU key', () => {
    const tagged = addGTIdentifier(<Plural n={0} _0='None' other='Some' />);

    expect(writeChildrenAsObjects(tagged)).toEqual({
      t: 'Plural',
      i: 1,
      d: { b: { '=0': 'None', other: 'Some' }, t: 'p' },
    });
    expect(
      renderDefaultChildren({
        children: tagged,
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toBe('None');
  });

  it('stores and renders an ordinal Plural', () => {
    const tagged = addGTIdentifier(
      <Plural n={2} ordinal one='1st' two='2nd' other='nth' />
    );

    expect(writeChildrenAsObjects(tagged)).toEqual({
      t: 'Plural',
      i: 1,
      d: { b: { one: '1st', two: '2nd', other: 'nth' }, t: 'o' },
    });
    expect(
      renderDefaultChildren({
        children: tagged,
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toBe('2nd');
    expect(
      renderTranslatedChildren({
        source: tagged,
        target: {
          d: { b: { one: '1er', other: 'e' }, t: 'o' },
        } as TranslatedChildren,
        locales: ['fr'],
        enableI18n: true,
      })
    ).toBe('e');
  });

  it('renders <RelativeTime> in <T> source content as formatted time', () => {
    initializeI18nConfig({ defaultLocale: 'en' });
    const tagged = addGTIdentifier([
      'Posted ',
      <RelativeTime key='time' value={-3} unit='day' />,
    ]);

    const rendered = renderDefaultChildren({
      children: tagged,
      defaultLocale: 'en',
      enableI18n: true,
    });

    expect(renderText(rendered)).toBe('Posted 3 days ago');
  });
});

describe('a variable name with the reserved _gt_ prefix', () => {
  const RESERVED =
    'A variable name starts with the reserved "_gt_" prefix. Pick another name. Details: name: _gt_2.';
  // The unnamed variable is _gt_2 as well, so one value would render twice.
  const tagged = () =>
    addGTIdentifier([
      <Var key='first' name='_gt_2'>
        Alice
      </Var>,
      ' / ',
      <Var key='second'>Bob</Var>,
    ]);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('throws in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => writeChildrenAsObjects(tagged())).toThrow(RESERVED);
    expect(() =>
      renderDefaultChildren({
        children: tagged(),
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toThrow(RESERVED);
  });

  it('logs in production and keeps the name', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeChildrenAsObjects(tagged())).toEqual([
      { i: 1, k: '_gt_2', v: 'v' },
      ' / ',
      { i: 2, k: '_gt_2', v: 'v' },
    ]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'A variable name starts with the reserved "_gt_" prefix. The variable was rendered under that name. Pick another name. Details: name: _gt_2.'
      )
    );
  });
});
