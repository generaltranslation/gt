import { ImportTracker } from '../state/ImportTracker';
import { StringCollector } from '../state/StringCollector';
import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Process program:
 * - Program: { ... }
 */
export function processProgram(
  state: TransformState
): VisitNode<t.Node, t.Program> {
  return {
    enter() {
      // Initialize trackers for this program
      state.importTracker = new ImportTracker();
      state.stringCollector = new StringCollector();
    },
  };
}
