import type {
  NodePath,
  TraverseOptions,
  VisitNodeFunction,
} from '@babel/traverse';
import type * as t from '@babel/types';
import { collectionPass as regularCollectionPass } from '../../passes/collectionPass';
import type { TransformState } from '../../state/types';
import {
  checkUnaryChildren,
  observeCallExpression,
  takeCollectionSnapshot,
} from '../processing/collection/observeCallExpression';
import { observeTaggedTemplateExpression } from '../processing/collection/observeTaggedTemplateExpression';
import type { LocaleTwinCollector } from '../state/LocaleTwinCollector';
import type { ImportSourceAliases } from '../utils/importSourceAliases';

/**
 * Collection pass of the experimental plugin: the regular collection pass,
 * which also rejects the unary `<T>` children that locale twins would render
 * differently ({@link checkUnaryChildren}). With a collector (a module the
 * locale twins pass runs on), the entry the regular pass registered for each
 * call and tagged template it visits goes to the module's
 * {@link LocaleTwinCollector}; calls of a regular GT entry point (not an
 * aliased `/experimental` one) stay unattributed.
 */
export function collectionPass(
  state: TransformState,
  collector: LocaleTwinCollector | undefined,
  importSources: ImportSourceAliases
): TraverseOptions {
  const regular = regularCollectionPass(state);
  const processCallExpression = regular.CallExpression as VisitNodeFunction<
    t.Node,
    t.CallExpression
  >;
  const processTaggedTemplateExpression =
    regular.TaggedTemplateExpression as VisitNodeFunction<
      t.Node,
      t.TaggedTemplateExpression
    >;
  return {
    ...regular,
    CallExpression(path: NodePath<t.CallExpression>, pluginState) {
      checkUnaryChildren(path, state);
      const before = takeCollectionSnapshot(state);
      processCallExpression.call(this, path, pluginState);
      if (collector) {
        observeCallExpression(path, state, collector, before, importSources);
      }
    },
    TaggedTemplateExpression(
      path: NodePath<t.TaggedTemplateExpression>,
      pluginState
    ) {
      processTaggedTemplateExpression.call(this, path, pluginState);
      if (collector) observeTaggedTemplateExpression(path, state, collector);
    },
  };
}
