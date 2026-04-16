import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { basePass } from './basePass';
import { processCallExpression } from '../processing/collection/processCallExpression';
import { processVariableDeclarator } from '../processing/collection/processVariableDeclarator';
import { processTaggedTemplateExpression } from '../processing/collection/processTaggedTemplateExpression';

/**
 * Collection pass — collect translation data without transforming.
 * Tracks imports, variable declarations, and GT function invocations.
 */
export function collectionPass(state: TransformState): TraverseOptions {
  return {
    ...basePass(state),
    CallExpression: processCallExpression(state),
    VariableDeclarator: processVariableDeclarator(state),
    TaggedTemplateExpression: processTaggedTemplateExpression(state),
  };
}
