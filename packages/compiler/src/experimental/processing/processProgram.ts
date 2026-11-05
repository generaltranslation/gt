import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal/experimental';
import { getLocaleTwinRegistrationImportSource } from '../utils/importSources';
import type { LocaleTwinTransform } from '../transform/twinTransform';
import { injectLocaleTwinRegistration } from '../transform/injectLocaleTwinRegistration';
import { injectMsgHashes } from '../transform/injectMsgHashes';
import { stripSourceText } from '../transform/stripSourceText';

/**
 * Process program for the locale twins pass:
 * - Skips modules without a GT import source that exports the registration
 *   function
 * - Modules without attributed entries get a registration without a
 *   placeholder: it tells the runtime that compiled code ran, so it can
 *   tell a missing compiler plugin apart from a page whose modules carry no
 *   attributed entries
 * - Injects `$_hash` into attributed msg() calls
 * - Inserts the registration call carrying the module's placeholder
 * - In client production builds, strips the attributed source text
 */
export function processProgram(
  twin: LocaleTwinTransform
): VisitNode<t.Node, t.Program> {
  return (path) => {
    const importSource = findRegistrationImportSource(path.node);
    if (!importSource) return;

    const sources = twin.collector.getSources();
    if (Object.keys(sources).length === 0) {
      injectLocaleTwinRegistration(path, importSource);
      twin.runtimeRegistered = true;
      path.stop();
      return;
    }

    injectMsgHashes(twin.collector);
    injectLocaleTwinRegistration(
      path,
      importSource,
      encodeLocaleTwinPlaceholder(sources)
    );
    twin.registered = true;
    if (twin.stripSourceText) stripSourceText(twin.collector);
    path.stop();
  };
}

/**
 * The registration import source for the first value import from a GT import
 * source, so it resolves wherever the module's own GT imports resolve.
 */
function findRegistrationImportSource(program: t.Program): string | undefined {
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    if (statement.importKind === 'type' || statement.importKind === 'typeof') {
      continue;
    }
    const importSource = getLocaleTwinRegistrationImportSource(
      statement.source.value
    );
    if (importSource) return importSource;
  }
  return undefined;
}
