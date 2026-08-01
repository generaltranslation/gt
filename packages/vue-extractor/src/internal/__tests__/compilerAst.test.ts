import {
  ElementTypes as VueElementTypes,
  NodeTypes as VueNodeTypes,
} from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';
import { ElementTypes, NodeTypes } from '../compilerAst.js';

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
});
