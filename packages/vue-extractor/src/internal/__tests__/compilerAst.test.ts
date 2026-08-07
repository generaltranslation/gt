import {
  ElementTypes as VueElementTypes,
  NodeTypes as VueNodeTypes,
} from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';
import {
  ElementTypes,
  NodeTypes,
  shiftCompilerAstLocations,
} from '../compilerAst.js';

describe('local Vue compiler AST discriminants', () => {
  it('matches the installed Vue compiler', () => {
    expect(NodeTypes).toEqual({
      ELEMENT: VueNodeTypes.ELEMENT,
      TEXT: VueNodeTypes.TEXT,
      COMMENT: VueNodeTypes.COMMENT,
      SIMPLE_EXPRESSION: VueNodeTypes.SIMPLE_EXPRESSION,
      INTERPOLATION: VueNodeTypes.INTERPOLATION,
      ATTRIBUTE: VueNodeTypes.ATTRIBUTE,
      DIRECTIVE: VueNodeTypes.DIRECTIVE,
    });
    expect(ElementTypes).toEqual({
      COMPONENT: VueElementTypes.COMPONENT,
      SLOT: VueElementTypes.SLOT,
    });
  });

  it('rebases shared compiler positions only once across nested locations', () => {
    const sharedStart = { column: 2, line: 1, offset: 1 };
    const sharedEnd = { column: 4, line: 2, offset: 8 };
    const ast = {
      children: [
        {
          loc: { end: sharedEnd, source: 'outer', start: sharedStart },
          nested: {
            loc: { end: sharedEnd, source: 'inner', start: sharedStart },
          },
        },
      ],
      loc: {
        end: { column: 1, line: 3, offset: 9 },
        source: 'root',
        start: { column: 1, line: 1, offset: 0 },
      },
    };

    shiftCompilerAstLocations(ast, { column: 7, line: 5, offset: 100 });

    expect(sharedStart).toEqual({ column: 8, line: 5, offset: 101 });
    expect(sharedEnd).toEqual({ column: 4, line: 6, offset: 108 });
  });
});
