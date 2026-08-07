import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import { readStaticPrimitive } from '../utils.js';

describe('readStaticPrimitive template literals', () => {
  it('uses cooked runtime text for every quasi', () => {
    const template = t.templateLiteral(
      [
        t.templateElement({ cooked: 'first\n', raw: 'first\\n' }),
        t.templateElement({ cooked: '\tlast', raw: '\\tlast' }, true),
      ],
      [t.stringLiteral('middle')]
    );

    expect(readStaticPrimitive(template)).toEqual({
      ok: true,
      value: 'first\nmiddle\tlast',
    });
  });

  it.each(['first', 'later'] as const)(
    'fails closed when the %s quasi has no cooked runtime value',
    (missingQuasi) => {
      const template = t.templateLiteral(
        [
          t.templateElement({ cooked: 'first', raw: 'first' }),
          t.templateElement({ cooked: 'last', raw: 'last' }, true),
        ],
        [t.stringLiteral('middle')]
      );
      template.quasis[missingQuasi === 'first' ? 0 : 1].value.cooked = null;

      expect(readStaticPrimitive(template)).toEqual({ ok: false });
    }
  );
});
