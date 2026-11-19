import React, { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '../../rendering/renderPipeline.rsc';
import { Branch } from '../../../components/branches/Branch';
import { Plural } from '../../../components/branches/Plural';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { Var } from '../../../components/variables/Var';
import type { GTTag, TaggedElement } from '../../types';

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
      { i: 1, v: 'rt' },
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
      <Plural n={1} one={<RelativeTime value={-3} unit='day' />}>
        Later
      </Plural>
    );

    expect(gtTag(gtTag(tagged).branches?.one)).toMatchObject({
      variableType: 'relativetime',
    });
  });

  it('stores an exact Plural branch under its ICU key', () => {
    const tagged = addGTIdentifier(
      <Plural n={0} _0='None'>
        Some
      </Plural>
    );

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

  it('stores the children of a Branch as other, over an other prop', () => {
    const tagged = addGTIdentifier(
      <Branch branch='x' {...{ other: 'Prop' }}>
        Children
      </Branch>
    );

    expect(gtTag(tagged).branches).toEqual({ other: 'Children' });
  });

  it('neither stores nor renders an other prop of a Branch with no children', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tagged = addGTIdentifier(
      <Branch branch='missing' {...{ other: 'Prop' }}>
        {undefined}
      </Branch>
    );

    expect(writeChildrenAsObjects(tagged)).toEqual({ t: 'Branch', i: 1 });
    expect(
      renderDefaultChildren({
        children: tagged,
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Branch> has no branch for its value')
    );
    error.mockRestore();
  });

  // `gt` and the compiler give this source the same hash; a tag name is not hashed.
  it.each([null, false, ''])(
    'stores no branches for a lone empty fallback: %j',
    (empty) => {
      const sources = [
        [
          'Before ',
          <Branch key='b' branch='x'>
            {empty}
          </Branch>,
          ' after',
        ],
        [
          'Before ',
          <Plural key='p' n={2}>
            {empty}
          </Plural>,
          ' after',
        ],
      ].map((source) => writeChildrenAsObjects(addGTIdentifier(source)));

      expect(sources).toEqual([
        ['Before ', { t: 'Branch', i: 1 }, ' after'],
        ['Before ', { t: 'Plural', i: 1 }, ' after'],
      ]);
      expect(
        sources.map((source) => hashSource({ dataFormat: 'JSX', source }))
      ).toEqual(['b5a6ee4eef4e3071', 'b5a6ee4eef4e3071']);
    }
  );

  it('stores a name only for a variable that was given one', () => {
    const tagged = addGTIdentifier([
      <Var key='a'>Alice</Var>,
      ' / ',
      <Var key='b' name='user'>
        Bob
      </Var>,
      <Var key='c' name=''>
        Eve
      </Var>,
    ]);

    expect(writeChildrenAsObjects(tagged)).toEqual([
      { i: 1, v: 'v' },
      ' / ',
      { i: 2, k: 'user', v: 'v' },
      { i: 3, v: 'v' },
    ]);
  });

  it('finds a translated variable by its id, so equal names do not collide', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    const source = addGTIdentifier([
      <Var key='a' name='who'>
        Alice
      </Var>,
      ' / ',
      <Var key='b' name='who'>
        Bob
      </Var>,
    ]);

    expect(
      renderText(
        renderTranslatedChildren({
          source,
          target: [
            { i: 2, k: 'who', v: 'v' },
            ' / ',
            { i: 1, k: 'who', v: 'v' },
          ],
          locales: ['fr'],
          enableI18n: true,
        })
      )
    ).toBe('Bob / Alice');
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
