import React, { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import { renderDefaultChildren } from '../../rendering/renderPipeline';
import { Plural } from '../../../components/branches/Plural';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
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
      { i: 1, k: '_gt_time_1', v: 'rt' },
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
      <Plural n={1} one={<RelativeTime value={-3} unit='day' />} />
    );

    expect(gtTag(gtTag(tagged).branches?.one)).toMatchObject({
      variableType: 'relativetime',
    });
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
