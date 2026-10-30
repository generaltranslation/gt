import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { LOCALE_TWIN_REGISTRATION_FUNCTION } from '../utils/importSources';

/**
 * Inserts the locale twins registration for a module:
 *
 * ```js
 * import { GtInternalRegisterLocaleTwin as _GtInternalRegisterLocaleTwin } from 'gt-react/experimental';
 * _GtInternalRegisterLocaleTwin("__GT_LOCALE_TWIN__:<hashes>:<payload>");
 * ```
 *
 * Both statements go after the module's leading imports (and therefore after
 * any directive prologue, which Babel keeps in `program.directives`), so the
 * call runs before the rest of the module body. The placeholder is a string
 * literal argument of a call to an imported function with side effects, so
 * minifiers keep it and tree-shaking cannot drop it; the call's result is
 * intentionally unused. Without a placeholder (a module without attributed
 * entries) the call has no argument and only records that compiled code ran.
 */
export function injectLocaleTwinRegistration(
  programPath: NodePath<t.Program>,
  importSource: string,
  placeholder?: string
): void {
  const local = programPath.scope.generateUidIdentifier(
    LOCALE_TWIN_REGISTRATION_FUNCTION
  );
  const importDecl = t.importDeclaration(
    [t.importSpecifier(local, t.identifier(LOCALE_TWIN_REGISTRATION_FUNCTION))],
    t.stringLiteral(importSource)
  );
  const registration = t.expressionStatement(
    t.callExpression(
      t.identifier(local.name),
      placeholder === undefined ? [] : [t.stringLiteral(placeholder)]
    )
  );

  const body = programPath.node.body;
  let index = 0;
  while (index < body.length && t.isImportDeclaration(body[index])) index++;
  body.splice(index, 0, importDecl, registration);
}
