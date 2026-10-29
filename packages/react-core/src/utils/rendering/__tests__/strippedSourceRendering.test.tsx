/**
 * Locale twin client builds blank the text inside `<T>` (children and html
 * content props become `""`). Translated JSX from the registry must still
 * render into those stripped elements.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderTranslatedChildren } from '../renderPipeline';
import { addGTIdentifier } from '../../internal/addGTIdentifier';
import type { TranslatedChildren } from '../../types';

function render(source: React.ReactNode, target: unknown) {
  return renderTranslatedChildren({
    source: addGTIdentifier(source),
    target: target as TranslatedChildren,
    locales: ['fr', 'en'],
    enableI18n: true,
  });
}

describe('rendering translations into stripped source', () => {
  it('fills an element whose only child was stripped to ""', () => {
    const result = render(
      [
        '',
        <b key='b' className='x'>
          {''}
        </b>,
      ],
      ['Bonjour ', { i: 1, c: 'le monde' }]
    ) as React.ReactElement[];

    const element = (result[1] as React.ReactElement<{ children: unknown }>)
      .props.children as React.ReactElement<Record<string, unknown>>;
    expect(element.type).toBe('b');
    expect(element.props.className).toBe('x');
    expect(element.props.children).toBe('le monde');
  });

  it('applies translated html content props to a childless element', () => {
    const result = render(<input placeholder='' title='' type='text' />, {
      i: 1,
      d: { pl: 'Votre nom', ti: 'Nom' },
    }) as React.ReactElement<Record<string, unknown>>;

    expect(result.type).toBe('input');
    expect(result.props.placeholder).toBe('Votre nom');
    expect(result.props.title).toBe('Nom');
    expect(result.props.type).toBe('text');
    expect(result.props['data-_gt']).toBeUndefined();
  });
});
