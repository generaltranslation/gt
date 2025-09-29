import crypto from 'crypto';
import {
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from 'generaltranslation/types';
import * as t from '@babel/types';
import { hashSource } from 'generaltranslation/id';
import { TransformState } from '../transform/types';
import {
  extractComponentNameFromJSXCall,
  getOriginalNameFromExpression,
} from '../transform/jsxUtils';
import { isVariableComponent } from '../visitor/analysis';
import { getAttr } from '../jsxUtils/getAttr';

/**
 * Create jsx variable
 */
function createJsxVariable(state: TransformState, variable: any): Variable {
  return;
}

/**
 * Create jsx element
 */
function createJsxElement(
  state: TransformState,
  element: t.Expression | t.SpreadElement | null
): JsxElement {
  // Get rid of spread and null
  return;
}

function isVariable(state: TransformState, child: t.Expression): boolean {
  // Get original name
  const originalName = getOriginalNameFromExpression(state, child);
  if (!originalName) {
    return false;
  }

  // Check if it's a variable component
  if (!isVariableComponent(originalName)) {
    return false;
  }

  return true;
}

/**
 * Create jsx child
 */
function createJsxChild(state: TransformState, child: t.Expression): JsxChild {
  // handle string
  if (t.isStringLiteral(child)) {
    return child.value;
  }

  // handle variable
  if (!t.isSpreadElement(child) && child !== null && isVariable(state, child)) {
    return createJsxVariable(state, child);
  }

  // handle element
  return createJsxElement(state, child);
}

/**
 * Create jsxChildren
 */
function createJsxChildren(
  state: TransformState,
  children: t.JSXElement
): JsxChildren {
  if (t.isArrayExpression(children)) {
    return children.elements
      .filter((element) => element !== null && !t.isSpreadElement(element))
      .map((element) => createJsxChild(state, element as t.Expression));
  } else {
    return createJsxChild(state, children);
  }
}

/**
 * Hash jsx source, this must be called on a <T> or <Tx> component
 */
export function hashJsx(source: t.JSXElement): string {
  // Validate that the source is a <T> or <Tx> component

  // Collect relevant data for hashing
  const jsxChildren = createJsxChildren(source);
  const id = getAttr(source, 'id') || getAttr(source, '$id');
  const context = getAttr(source, 'context') || getAttr(source, '$context');

  // Hash the source
  return hashSource({
    source: jsxChildren,
    id,
    context,
    dataFormat: 'JSX',
  });
}
