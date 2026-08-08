import { parse } from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';
import {
  ElementTypes,
  NodeTypes,
  shiftCompilerAstLocations,
} from '../compilerAst.js';

describe('local Vue compiler AST discriminants', () => {
  it('matches the installed Vue compiler', () => {
    const root = parse(
      '<Probe plain v-bind:title="title">text<!--comment-->{{ value }}</Probe>'
    );
    const element = root.children[0];
    const slot = parse('<slot />').children[0];
    if (element?.type !== 1 || slot?.type !== 1) {
      throw new Error('Vue returned an unknown element AST shape');
    }
    const text = element.children.find((child) => child.type === 2);
    const comment = element.children.find((child) => child.type === 3);
    const interpolation = element.children.find((child) => child.type === 5);
    const attribute = element.props.find((property) => property.type === 6);
    const directive = element.props.find((property) => property.type === 7);
    if (!text || !comment || !interpolation || !attribute || !directive) {
      throw new Error('Vue returned an incomplete compiler AST probe');
    }

    expect(NodeTypes).toEqual({
      ELEMENT: element.type,
      TEXT: text.type,
      COMMENT: comment.type,
      SIMPLE_EXPRESSION: interpolation.content.type,
      INTERPOLATION: interpolation.type,
      ATTRIBUTE: attribute.type,
      DIRECTIVE: directive.type,
    });
    expect(ElementTypes).toEqual({
      COMPONENT: element.tagType,
      SLOT: slot.tagType,
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
