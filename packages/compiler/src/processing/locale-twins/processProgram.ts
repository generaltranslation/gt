import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal';
import { TransformState } from '../../state/types';
import { getLocaleTwinRegistrationImportSource } from '../../utils/constants/gt/helpers';
import { injectLocaleTwinRegistration } from '../../transform/locale-twins/injectLocaleTwinRegistration';
import { injectMsgHashes } from '../../transform/locale-twins/injectMsgHashes';
import { stripSourceText } from '../../transform/locale-twins/stripSourceText';

/**
 * Process program for the locale twins pass:
 * - Skips modules without a GT import source that exports the registration
 *   function
 * - Modules without attributed entries get a registration without a
 *   placeholder: it installs the locale twin runtime before the page
 *   registers its first twin (an entry that only lazy-imports its pages, or
 *   a page whose entries are all unattributed)
 * - Injects `$_hash` into attributed msg() calls
 * - Inserts the registration call carrying the module's placeholder
 * - In client production builds, strips the attributed source text
 */
export function processProgram(
  state: TransformState
): VisitNode<t.Node, t.Program> {
  return (path) => {
    const importSource = findRegistrationImportSource(path.node);
    if (!importSource) return;

    const sources = state.localeTwins.getSources();
    if (Object.keys(sources).length === 0) {
      injectLocaleTwinRegistration(path, importSource);
      state.statistics.localeTwinRuntimeRegistrationsCount += 1;
      path.stop();
      return;
    }

    injectMsgHashes(state);
    injectLocaleTwinRegistration(
      path,
      importSource,
      encodeLocaleTwinPlaceholder(sources)
    );
    state.statistics.localeTwinRegistrationsCount += 1;
    if (state.settings.stripSourceText) stripSourceText(state);
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
