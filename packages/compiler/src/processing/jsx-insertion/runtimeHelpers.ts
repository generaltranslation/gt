import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';
import { REACT_FUNTIONS } from '../../utils/constants/react/constants';

const missingRuntimeBinding = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Error',
  whatHappened:
    'Automatic JSX insertion could not resolve its React runtime binding',
  fix: 'Keep React JSX runtime imports available until automatic JSX insertion runs',
});

/** Select helpers from the owning call, including files mixing runtime modes. */
export function runtimeCallee(
  context: NodePath,
  multiple: boolean
): { callee: t.Identifier; development: boolean } {
  let owner: NodePath | null = context;
  while (owner) {
    if (owner.isCallExpression()) {
      const callee = owner.get('callee');
      if (callee.isIdentifier() && isReactJsxFunction(callee)) {
        const binding = callee.scope.getBinding(callee.node.name);
        const specifier = binding?.path;
        const declaration = specifier?.parentPath;
        if (
          specifier?.isImportSpecifier() &&
          declaration?.isImportDeclaration()
        ) {
          const imported = specifier.node.imported;
          const name = t.isIdentifier(imported)
            ? imported.name
            : imported.value;
          if (name === REACT_FUNTIONS.jsxDEV) {
            return { callee: t.cloneNode(callee.node), development: true };
          }
          const wanted = multiple ? REACT_FUNTIONS.jsxs : REACT_FUNTIONS.jsx;
          const program = context.findParent((path) => path.isProgram());
          if (!program?.isProgram()) break;
          const source = declaration.node.source.value;
          for (const statement of program.get('body')) {
            if (
              !statement.isImportDeclaration() ||
              statement.node.source.value !== source
            )
              continue;
            for (const candidate of statement.get('specifiers')) {
              if (
                !candidate.isImportSpecifier() ||
                candidate.node.importKind === 'type'
              )
                continue;
              const imported = candidate.node.imported;
              const name = t.isIdentifier(imported)
                ? imported.name
                : imported.value;
              const local = candidate.node.local;
              if (
                name === wanted &&
                context.scope.getBinding(local.name)?.path === candidate
              )
                return { callee: t.cloneNode(local), development: false };
            }
          }
          // Names must also be free in the insertion scope: a top-level helper
          // can be shadowed by a callback parameter or local declaration.
          let local = program.scope.generateUidIdentifier(wanted);
          while (context.scope.getBinding(local.name))
            local = program.scope.generateUidIdentifier(wanted);
          const [added] = program.unshiftContainer(
            'body',
            t.importDeclaration(
              [t.importSpecifier(local, t.identifier(wanted))],
              t.stringLiteral(source)
            )
          );
          program.scope.registerDeclaration(added);
          return { callee: t.cloneNode(local), development: false };
        }
      }
    }
    owner = owner.parentPath;
  }
  throw new Error(missingRuntimeBinding);
}
