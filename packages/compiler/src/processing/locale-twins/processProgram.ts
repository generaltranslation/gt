import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal';
import { TransformState } from '../../state/types';
import { isLocaleTwinsImportSource } from '../../utils/constants/gt/helpers';
import { injectLocaleTwinMarker } from '../../transform/locale-twins/injectLocaleTwinMarker';
import { stripSourceText } from '../../transform/locale-twins/stripSourceText';

/**
 * Process program for the locale twins pass:
 * - Skips modules without a GT import source that supports locale twins
 * - In client production builds, gives every attributed call site an
 *   unfilled placeholder (its hash and source content) as the `$_twin`
 *   option or `_twin` prop, which the twin generator fills per locale, and
 *   strips the attributed source text
 * - In every production build (client and server alike, so SSR renders what
 *   the client renders), marks entries the compiler cannot attribute with
 *   `$_twin: 0` / `_twin: 0`: they render their source text
 */
export function processProgram(
  state: TransformState
): VisitNode<t.Node, t.Program> {
  return (path) => {
    if (!hasLocaleTwinsImportSource(path.node)) return;
    state.statistics.localeTwinModulesCount = 1;

    if (state.settings.stripSourceText) {
      // unattribute() replaces the entry list, so this loop is unaffected
      for (const entry of state.localeTwins.getEntries()) {
        const placeholder = t.stringLiteral(
          encodeLocaleTwinPlaceholder(entry.hash, entry.source)
        );
        if (injectLocaleTwinMarker(entry.api, entry.node, placeholder)) {
          state.statistics.localeTwinPlaceholdersCount += 1;
        } else {
          state.localeTwins.unattribute(entry, 'call');
        }
      }
    }

    for (const entry of state.localeTwins.getUnattributed(true)) {
      if (
        t.isCallExpression(entry.node) &&
        injectLocaleTwinMarker(entry.api, entry.node, t.numericLiteral(0))
      ) {
        state.statistics.localeTwinSourceMarkersCount += 1;
      }
    }

    if (state.settings.stripSourceText) stripSourceText(state);
    path.stop();
  };
}

/** Whether a value import of the module comes from a GT source with locale twins. */
function hasLocaleTwinsImportSource(program: t.Program): boolean {
  return program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) &&
      statement.importKind !== 'type' &&
      statement.importKind !== 'typeof' &&
      isLocaleTwinsImportSource(statement.source.value)
  );
}
