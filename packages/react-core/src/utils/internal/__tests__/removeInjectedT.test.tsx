import React from 'react';
import { describe, expect, it } from 'vitest';
import { removeInjectedT } from '../removeInjectedT';
import { Derive } from '../../../components/derivation/Derive';
import { Ordinal } from '../../../components/branches/Ordinal';
import { GtInternalTranslateJsx, T } from '../../../components/translation/T';

type Props = Record<string, React.ReactNode>;
const props = (node: React.ReactNode) =>
  (node as React.ReactElement<Props>).props;

describe('removeInjectedT', () => {
  it('removes the <T> the compiler inserted inside a <Derive>, in a branch too', () => {
    const result = removeInjectedT(
      <Derive>
        <Ordinal
          n={1}
          one={<GtInternalTranslateJsx>first</GtInternalTranslateJsx>}
        >
          <GtInternalTranslateJsx>nth</GtInternalTranslateJsx>
        </Ordinal>
      </Derive>
    );

    const ordinal = props(props(result).children);
    expect(ordinal.one).toBe('first');
    expect(ordinal.children).toBe('nth');
  });

  it('keeps a <T> the user wrote', () => {
    const result = removeInjectedT(
      <Derive>
        <T>kept</T>
      </Derive>
    );

    expect((props(result).children as React.ReactElement).type).toBe(T);
  });
});
