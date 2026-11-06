import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { warnUnfollowedUnstableImportSync } from '../../../../../console/index.js';
import type { GTLibrary } from '../../../../../types/libraries.js';
import {
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  T_REGISTRATION_FUNCTION,
} from '../../constants.js';
import { loadTypeScript } from '../../typeChecker.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { formatLocation } from './diagnostics.js';
import { processHookReference, processTagBinding } from './followTags.js';
import { getImportedName } from './imports.js';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Extracts tagged-template messages written with the unstable `t`, `useGT()`,
 * and `getGT()` APIs as message tree updates (`dataFormat: 'ICU_TREE'`).
 *
 * Supports t`...`, t({ ...options })`...`, and the same forms on a
 * `const gt = useGT()` / `const gt = await getGT()` result, including const
 * aliases (`const tr = gt`) and configured tags (`const save = gt({ ... })`).
 * Messages that are not statically analyzable are skipped with a warning, and
 * so are uses of a tag that cannot be followed.
 */
export async function extractMessageTrees(
  ast: t.File,
  pkgs: readonly GTLibrary[],
  config: ParsingConfig,
  output: ParsingOutput
): Promise<void> {
  const isExtractedSource = (source: string) =>
    isUnstableGTImportSource(source) &&
    pkgs.some((pkg) => source.startsWith(`${pkg}/`));
  // Only messages from an imported tag read types, so only those files load
  // TypeScript.
  if (
    ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) && isExtractedSource(node.source.value)
    )
  ) {
    await loadTypeScript(config.file);
  }
  const warnUnfollowed = (source: string, node: t.Node) =>
    output.warnings.add(
      warnUnfollowedUnstableImportSync(
        config.file,
        source,
        formatLocation(node)
      )
    );
  traverse(ast, {
    // require('gt-react/unstable') and import('gt-react/unstable')
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      const isLoader =
        t.isImport(callee) ||
        (t.isIdentifier(callee, { name: 'require' }) &&
          !path.scope.hasBinding('require'));
      const [source] = args;
      if (!isLoader || !t.isStringLiteral(source)) return;
      if (!isExtractedSource(source.value)) return;
      warnUnfollowed(source.value, path.node);
    },
    // export { t } from 'gt-react/unstable' and export * from 'gt-react/unstable'
    'ExportNamedDeclaration|ExportAllDeclaration'(path) {
      const node = path.node as
        | t.ExportNamedDeclaration
        | t.ExportAllDeclaration;
      if (!node.source || !isExtractedSource(node.source.value)) return;
      const typeOnly =
        node.exportKind === 'type' ||
        (t.isExportNamedDeclaration(node) &&
          node.specifiers.every(
            (specifier) =>
              t.isExportSpecifier(specifier) && specifier.exportKind === 'type'
          ));
      if (!typeOnly) warnUnfollowed(node.source.value, node);
    },
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (!isExtractedSource(source)) return;
      for (const specifier of path.node.specifiers) {
        if (
          t.isImportNamespaceSpecifier(specifier) &&
          path.node.importKind !== 'type'
        ) {
          warnUnfollowed(source, specifier);
          continue;
        }
        if (!t.isImportSpecifier(specifier)) continue;
        const importedName = getImportedName(specifier);
        const binding = path.scope.getBinding(specifier.local.name);
        if (!binding) continue;
        if (importedName === T_REGISTRATION_FUNCTION) {
          processTagBinding(binding, undefined, config, output);
        } else if (
          importedName === INLINE_TRANSLATION_HOOK ||
          importedName === INLINE_TRANSLATION_HOOK_ASYNC
        ) {
          for (const ref of binding.referencePaths) {
            processHookReference(ref, config, output);
          }
        }
      }
    },
  });
}
