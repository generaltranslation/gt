import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { ScopeTracker } from '../state/ScopeTracker';

/**
 * Process program:
 * - Program: { ... }
 */
export function processProgram(
  state: TransformState
): VisitNode<t.Node, t.Program> {
  return {
    enter() {
      state.scopeTracker = new ScopeTracker();
      state.stringCollector.resetCounter();
    },
  };
}
