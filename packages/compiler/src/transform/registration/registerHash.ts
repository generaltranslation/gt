import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { getAttr } from '../../utils/getAttr';
import { annotateJsxElement } from '../jsx-annotation/annotateJsxElement';
import { hashJsx } from '../../utils/hash/hashJsx';
import { TranslationJsx } from '../../state/string-collector';

/**
 * Record the hash for a JSX element
 */
export function registerHash(
  nodePath: NodePath<t.JSXElement>,
  state: TransformState
): void {
  // Check if hash attribute already exists
  if (getAttr(nodePath.node, '_hash')) return;

  // Strip aliased names from element (<_T> -> <T>)
  const annotatedElement: t.JSXElement = annotateJsxElement(
    nodePath.node,
    state
  );

  // Calculate real hash using AST traversal
  const hash = hashJsx(annotatedElement);

  // Store the translation JSX
  const counterId = state.stringCollector.incrementCounter();
  state.stringCollector.initializeAggregator(counterId);

  // Add the message to the string collector for the JSX element
  state.stringCollector.setTranslationJsx(counterId, {
    hash,
  } as TranslationJsx);
}
