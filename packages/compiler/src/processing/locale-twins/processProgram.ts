import { NodePath, VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import {
  createDiagnosticMessage,
  encodeLocaleTwinPlaceholder,
} from 'generaltranslation/internal';
import { TransformState } from '../../state/types';
import type {
  LocaleTwinEntryApi,
  LocaleTwinUnattributedEntry,
} from '../../state/LocaleTwinCollector';
import { isLocaleTwinsImportSource } from '../../utils/constants/gt/helpers';
import { createErrorLocation } from '../../utils/errors';
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
 *   `$_twin: 0` / `_twin: 0`: they render their source text. Tagged
 *   templates the macro transform left in place are expanded into calls
 *   first, so they can carry the marker.
 * - Reports call sites that cannot carry a marker (spread arguments) as
 *   errors: without one, the server and the browser would render them
 *   differently
 */
export function processProgram(
  state: TransformState
): VisitNode<t.Node, t.Program> {
  return (path) => {
    if (!hasLocaleTwinsImportSource(path.node)) return;
    state.statistics.localeTwinModulesCount = 1;

    if (state.settings.stripSourceText) {
      for (const entry of state.localeTwins.getEntries()) {
        const placeholder = t.stringLiteral(
          encodeLocaleTwinPlaceholder(entry.hash, entry.source)
        );
        if (injectLocaleTwinMarker(entry.api, entry.node, placeholder)) {
          state.statistics.localeTwinPlaceholdersCount += 1;
        } else {
          reportUnmarkableCall(state, entry.api, entry.node);
        }
      }
    }

    const unattributed = state.localeTwins.getUnattributed(true);
    expandTaggedTemplates(path, state, unattributed);
    for (const entry of unattributed) {
      if (!t.isCallExpression(entry.node)) continue;
      if (injectLocaleTwinMarker(entry.api, entry.node, t.numericLiteral(0))) {
        state.statistics.localeTwinSourceMarkersCount += 1;
      } else {
        reportUnmarkableCall(state, entry.api, entry.node);
      }
    }

    if (state.settings.stripSourceText) stripSourceText(state);
    path.stop();
  };
}

/**
 * Replaces each unattributed tagged template with a call carrying the `0`
 * marker, built like the runtime's tagged template path builds its message:
 * t`Hi ${name}` → t("Hi {0}", { "0": name }), one variable per substitution
 * whatever its expression (`${a + b}` stays one value). The runtime's tagged
 * template path has no options to carry the marker.
 */
function expandTaggedTemplates(
  program: NodePath<t.Program>,
  state: TransformState,
  unattributed: LocaleTwinUnattributedEntry[]
): void {
  const tagged = new Set(
    unattributed
      .map((entry) => entry.node)
      .filter((node) => t.isTaggedTemplateExpression(node))
  );
  if (tagged.size === 0) return;
  program.traverse({
    TaggedTemplateExpression(path) {
      if (!tagged.has(path.node)) return;
      const { quasis, expressions } = path.node.quasi;
      let message = '';
      const variables: t.ObjectProperty[] = [];
      quasis.forEach((quasi, index) => {
        message += quasi.value.cooked ?? quasi.value.raw;
        const expression = expressions[index];
        if (expression === undefined || !t.isExpression(expression)) return;
        message += `{${index}}`;
        variables.push(
          t.objectProperty(t.stringLiteral(String(index)), expression)
        );
      });
      const args: t.Expression[] = [t.stringLiteral(message)];
      if (variables.length > 0) args.push(t.objectExpression(variables));
      const call = t.callExpression(path.node.tag, args);
      injectLocaleTwinMarker('t', call, t.numericLiteral(0));
      path.replaceWith(call);
      state.statistics.localeTwinSourceMarkersCount += 1;
    },
  });
}

function reportUnmarkableCall(
  state: TransformState,
  api: LocaleTwinEntryApi,
  node: t.CallExpression
): void {
  state.errorTracker.addError(
    createDiagnosticMessage({
      whatHappened: `Locale twins cannot mark a ${api}() call that spreads its arguments`,
      fix: 'Pass the message and the options as separate arguments, so the server and the browser render it alike',
      details: [`at${createErrorLocation(node)}`],
    })
  );
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
